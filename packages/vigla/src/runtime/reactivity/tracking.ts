import type { Batch } from './batch.ts';
import { unsafeMutation } from './errors.ts';
import {
	BLOCK,
	CLEAN,
	DIRTY,
	EAGER,
	MAYBE,
	isDerived,
	now,
	stamp,
	type Derived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';

interface Frame {
	readonly reads: Source[];
	readonly derived: boolean;
	readonly guarded: boolean;
	readonly eager: boolean;
	invalidated: boolean;
	hidden: Set<Batch> | null;
	local: Set<Source> | null;
}

function opened(target: Reaction): Frame {
	const derived = isDerived(target);
	const kind = (target as Effect).kind;
	const eager = kind === EAGER;
	const current: Frame = {
		reads: [],
		derived,
		guarded: derived || eager || kind === BLOCK,
		eager,
		invalidated: false,
		hidden: null,
		local: null
	};
	frame = current;
	frames.push(current);
	return current;
}

function closed(previous: Frame | null): void {
	frames.pop();
	frame = previous;
}

export function localize(source: Source): void {
	const depth = frames.length;
	if (depth === 0) return;
	const top = frames[depth - 1] as Frame;
	if (top.derived) (top.local ??= new Set()).add(source);
}

export function local(source: Source): boolean {
	const depth = frames.length;
	if (depth === 0) return false;
	const top = frames[depth - 1] as Frame;
	return top.local !== null && top.local.has(source);
}

export function guard(source: Source): void {
	const at = frame ?? (frames.length === 0 ? null : (frames[frames.length - 1] as Frame));
	if (at === null || !(frame === null ? at.eager : at.guarded)) return;
	if (at.local === null || !at.local.has(source)) unsafeMutation();
}

export const NONE: unique symbol = Symbol('none');

export type Prior = (source: Source) => unknown;

interface Past {
	readonly before: Prior;
	readonly later: Prior | null;
	written: Set<Source> | null;
	derived: Map<Derived, unknown> | null;
}

export interface View {
	readonly batch: Batch;
	readonly values: Map<Source, unknown>;
	readonly hidden: Map<Source, Batch>;
	readonly checked: Map<Derived, boolean>;
	readonly reached: Map<Derived, Set<Batch>>;
}

let frame: Frame | null = null;
const frames: Frame[] = [];
let past: Past | null = null;
let hiddenByLast: Set<Batch> | null = null;

export let view: View | null = null;

export let owner: Effect | null = null;

export function setOwner(effect: Effect | null): Effect | null {
	const previous = owner;
	owner = effect;
	return previous;
}

export function setView(next: View | null): View | null {
	const previous = view;
	view = next;
	return previous;
}

export function get<T>(source: Source<T>): T {
	if (frame !== null && (frame.local === null || !frame.local.has(source)))
		frame.reads.push(source);
	if (past !== null) return recall(source, past) as T;
	if (view !== null) return through(source, view) as T;
	if (isDerived(source)) refresh(source);
	return source.v;
}

export function reading(): boolean {
	return frame !== null;
}

export function untrack<T>(fn: () => T): T {
	const previous = frame;
	frame = null;
	try {
		return fn();
	} finally {
		frame = previous;
	}
}

function note(hidden: Iterable<Batch>): void {
	if (frame === null) return;
	for (const batch of hidden) (frame.hidden ??= new Set()).add(batch);
}

export function affected(derived: Derived, given: View): boolean {
	const known = given.checked.get(derived);
	if (known !== undefined) return known;
	given.checked.set(derived, false);
	let found = derived.deps === null;
	for (const dep of derived.deps ?? []) {
		if (given.values.has(dep) || (isDerived(dep) && affected(dep, given))) {
			found = true;
			break;
		}
	}
	given.checked.set(derived, found);
	return found;
}

function compute(derived: Derived, given: View): unknown {
	const previous = frame;
	const current = opened(derived);
	const previousOwner = setOwner(derived.owner);
	try {
		return derived.fn();
	} finally {
		closed(previous);
		setOwner(previousOwner);
		const deps = (derived.deps ??= []);
		if (deps.length === 0 && current.reads.length > 0) own(derived);
		for (const dep of current.reads) {
			if (deps.includes(dep)) continue;
			deps.push(dep);
			(dep.reactions ??= new Set()).add(derived);
		}
		if (current.hidden !== null) {
			given.reached.set(derived, current.hidden);
			note(current.hidden);
		}
	}
}

function through(source: Source, given: View): unknown {
	if (given.values.has(source)) {
		const hidden = given.hidden.get(source);
		if (hidden !== undefined) note([hidden]);
		else if (isDerived(source)) {
			const reached = given.reached.get(source);
			if (reached !== undefined) note(reached);
		}
		return given.values.get(source);
	}
	if (!isDerived(source)) return source.v;
	if (!affected(source, given)) {
		refresh(source);
		if (!given.values.has(source)) return source.v;
		const reached = given.reached.get(source);
		if (reached !== undefined) note(reached);
		return given.values.get(source);
	}
	const value = compute(source, given);
	given.values.set(source, value);
	return value;
}

export function conceal(source: Source, value: unknown, batch: Batch): void {
	if (view === null || view.values.has(source)) return;
	view.values.set(source, value);
	view.hidden.set(source, batch);
}

export function forget(source: Source): void {
	const given = view;
	if (given === null) return;
	given.values.delete(source);
	given.hidden.delete(source);
	const clear = (from: Source): void => {
		for (const reaction of from.reactions ?? []) {
			if (!isDerived(reaction) || !given.checked.has(reaction)) continue;
			given.checked.delete(reaction);
			given.values.delete(reaction);
			given.reached.delete(reaction);
			clear(reaction);
		}
	};
	clear(source);
}

export function present<T>(fn: () => T): T {
	const previousPast = past;
	const previousView = view;
	past = null;
	view = null;
	try {
		return fn();
	} finally {
		past = previousPast;
		view = previousView;
	}
}

export function recalling(before: Prior, later: Prior | null, fn: () => void): void {
	const previousPast = past;
	const previousFrame = frame;
	past = { before, later, written: null, derived: null };
	frame = null;
	try {
		fn.call(null);
	} finally {
		past = previousPast;
		frame = previousFrame;
	}
}

function dated(derived: Derived, given: Past): boolean {
	if (derived.deps === null) return true;
	for (const dep of derived.deps) {
		if (given.written?.has(dep)) continue;
		if (given.before(dep) !== NONE || (given.later !== null && given.later(dep) !== NONE))
			return true;
		if (isDerived(dep) && dated(dep, given)) return true;
	}
	return false;
}

function recall(source: Source, given: Past): unknown {
	if (given.written === null || !given.written.has(source)) {
		const before = given.before(source);
		if (before !== NONE) return before;
		if (given.later !== null) {
			const later = given.later(source);
			if (later !== NONE) return later;
		}
	}
	if (!isDerived(source)) return view === null ? source.v : through(source, view);
	if (given.derived !== null && given.derived.has(source)) return given.derived.get(source);
	if (!dated(source, given)) {
		if (view !== null) return through(source, view);
		refresh(source);
		return source.v;
	}
	const value = source.fn();
	(given.derived ??= new Map()).set(source, value);
	return value;
}

export function written(source: Source): void {
	if (past === null) return;
	(past.written ??= new Set()).add(source);
	past.derived = null;
}

export function readDuringRun(source: Source): void {
	for (let index = frames.length - 1; index >= 0; index--) {
		const current = frames[index] as Frame;
		if (!current.invalidated && current.reads.includes(source)) current.invalidated = true;
	}
}

function own(derived: Derived): void {
	const holder = derived.owner;
	if (holder !== null) (holder.owned ??= []).push(derived);
}

function reconcile(target: Reaction, next: Source[], keep: boolean): void {
	const previous = target.deps;
	const kept = new Set(next);
	for (const dep of previous ?? []) {
		if (keep) kept.add(dep);
		else if (!kept.has(dep)) dep.reactions?.delete(target);
	}
	for (const dep of kept) (dep.reactions ??= new Set()).add(target);
	target.deps = [...kept];
	if ((previous === null || previous.length === 0) && kept.size > 0 && isDerived(target))
		own(target);
}

export function track<T>(target: Reaction, fn: () => T): T {
	const previous = frame;
	const current = opened(target);
	try {
		return fn();
	} finally {
		closed(previous);
		hiddenByLast = current.hidden;
		if ((target as Effect).destroyed === true) target.deps = null;
		else settleRun(target, current);
	}
}

function settleRun(target: Reaction, current: Frame): void {
	let invalidated = current.invalidated;
	for (const dep of current.reads) {
		if (isDerived(dep) && dep.status !== CLEAN && (view === null || !view.values.has(dep)))
			invalidated = true;
	}
	reconcile(target, current.reads, view !== null && (view.batch.fork || current.hidden !== null));
	target.rv = now();
	target.status = invalidated ? DIRTY : CLEAN;
}

export function takeHidden(): Set<Batch> | null {
	const found = hiddenByLast;
	hiddenByLast = null;
	return found;
}

export function stale(target: Reaction): boolean {
	if (target.status === DIRTY) return true;
	if (target.status === MAYBE) {
		for (const dep of target.deps ?? []) {
			if (isDerived(dep)) {
				if (view !== null && affected(dep, view)) return true;
				refresh(dep);
				if (view !== null && view.values.has(dep)) return true;
			}
			if (dep.wv > target.rv) return true;
		}
		target.status = CLEAN;
	}
	return false;
}

export function refresh(derived: Derived): void {
	if (derived.deps !== null && !stale(derived)) return;
	if (view !== null && affected(derived, view)) return;
	const previous = setOwner(derived.owner);
	try {
		const value = track(derived, derived.fn);
		const hidden = hiddenByLast;
		hiddenByLast = null;
		if (hidden !== null && view !== null) {
			derived.status = DIRTY;
			view.values.set(derived, value);
			view.reached.set(derived, hidden);
			view.checked.set(derived, true);
			return;
		}
		if (!derived.computed || !Object.is(value, derived.v)) {
			derived.v = value;
			derived.wv = stamp();
			derived.computed = true;
		}
	} finally {
		setOwner(previous);
	}
}

export function disconnect(derived: Derived): void {
	for (const dep of derived.deps ?? []) dep.reactions?.delete(derived);
	derived.deps = null;
	derived.status = DIRTY;
}
