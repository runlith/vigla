import type { Batch } from './batch.ts';
import {
	CLEAN,
	DIRTY,
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
	invalidated: boolean;
	hidden: Set<Batch> | null;
}

interface Past {
	readonly before: Map<Source, unknown>;
	readonly later: Map<Source, unknown> | null;
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
	if (frame !== null) frame.reads.push(source);
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
	const current: Frame = { reads: [], invalidated: false, hidden: null };
	frame = current;
	const previousOwner = setOwner(derived.owner);
	try {
		return derived.fn();
	} finally {
		frame = previous;
		setOwner(previousOwner);
		const deps = (derived.deps ??= []);
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
		return source.v;
	}
	const value = compute(source, given);
	given.values.set(source, value);
	return value;
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

export function recalling(
	before: Map<Source, unknown>,
	later: Map<Source, unknown> | null,
	fn: () => void
): void {
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
		if (given.before.has(dep) || given.later?.has(dep)) return true;
		if (isDerived(dep) && dated(dep, given)) return true;
	}
	return false;
}

function recall(source: Source, given: Past): unknown {
	if (given.written === null || !given.written.has(source)) {
		if (given.before.has(source)) return given.before.get(source);
		if (given.later !== null && given.later.has(source)) return given.later.get(source);
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

function reconcile(target: Reaction, next: Source[]): void {
	const kept = new Set(next);
	for (const dep of target.deps ?? []) {
		if (view !== null) kept.add(dep);
		else if (!kept.has(dep)) dep.reactions?.delete(target);
	}
	for (const dep of kept) (dep.reactions ??= new Set()).add(target);
	target.deps = [...kept];
}

export function track<T>(target: Reaction, fn: () => T): T {
	const previous = frame;
	const current: Frame = { reads: [], invalidated: false, hidden: null };
	frame = current;
	frames.push(current);
	try {
		return fn();
	} finally {
		frames.pop();
		frame = previous;
		let invalidated = current.invalidated;
		for (const dep of current.reads) {
			if (isDerived(dep) && dep.status !== CLEAN && (view === null || !view.values.has(dep)))
				invalidated = true;
		}
		reconcile(target, current.reads);
		target.rv = now();
		target.status = invalidated ? DIRTY : CLEAN;
		hiddenByLast = current.hidden;
	}
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
		hiddenByLast = null;
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
