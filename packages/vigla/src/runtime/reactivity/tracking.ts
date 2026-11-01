import { DEV } from 'esm-env';
import type { Batch } from './batch.ts';
import { computed, traced, tracedRun, tracing, updated } from './trace.ts';
import { unsafeMutation } from './errors.ts';
import { destroy, fail, freeze, thaw } from './effects.ts';
import {
	BLOCK,
	CLEAN,
	DIRTY,
	EAGER,
	MAYBE,
	ROOT,
	equal,
	isDerived,
	now,
	stamp,
	type Derived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';

interface Frame {
	target: Reaction | null;
	started: number;
	version: number;
	old: Source[] | null;
	matched: number;
	extra: Source[] | null;
	derived: boolean;
	guarded: boolean;
	eager: boolean;
	invalidated: boolean;
	hidden: Set<Batch> | null;
	local: Set<Source> | null;
}

let versions = 0;
let depth = 0;

function opened(target: Reaction): Frame {
	const derived = isDerived(target);
	const kind = (target as Effect).kind;
	const eager = kind === EAGER;
	let current = frames[depth];
	if (current === undefined) {
		current = {
			target: null,
			started: 0,
			version: 0,
			old: null,
			matched: 0,
			extra: null,
			derived: false,
			guarded: false,
			eager: false,
			invalidated: false,
			hidden: null,
			local: null
		};
		frames.push(current);
	}
	current.target = target;
	if (DEV) current.started = now();
	current.version = versions += 3;
	current.old = target.deps;
	current.matched = 0;
	current.extra = null;
	current.derived = derived;
	current.guarded = derived || eager || kind === BLOCK;
	current.eager = eager;
	current.invalidated = false;
	current.hidden = null;
	current.local = null;
	depth++;
	frame = current;
	return current;
}

function closed(previous: Frame | null): void {
	depth--;
	(frames[depth] as Frame).target = null;
	frame = previous;
}

function finished(current: Frame): void {
	current.old = current.extra = null;
	current.hidden = null;
	current.local = null;
}

function top(): Frame | null {
	return depth === 0 ? null : (frames[depth - 1] as Frame);
}

export function ownEffect(effect: Effect): void {
	const at = frame ?? top();
	if (at === null || !at.derived || effect.kind === ROOT) return;
	const derived = at.target as Derived;
	if (effect.parent === derived.owner) (derived.effects ??= []).push(effect);
}

function destroyEffects(derived: Derived): void {
	const effects = derived.effects;
	if (effects === null) return;
	derived.effects = derived.frozen = null;
	for (const effect of effects) destroy(effect);
}

function subscribe(dep: Source, reaction: Reaction): void {
	const reactions = dep.reactions;
	if (reactions !== null) {
		reactions.push(reaction);
		return;
	}
	dep.reactions = [reaction];
	if (isDerived(dep) && dep.frozen !== null) thaw(dep);
}

export function unsubscribe(dep: Source, reaction: Reaction): void {
	const reactions = dep.reactions;
	if (reactions === null) return;
	const index = reactions.indexOf(reaction);
	if (index === -1) return;
	const last = reactions.length - 1;
	if (last > 0) {
		reactions[index] = reactions[last] as Reaction;
		reactions.pop();
		return;
	}
	dep.reactions = null;
	if (isDerived(dep) && dep.effects !== null) freeze(dep);
}

export function localize(source: Source): void {
	const at = top();
	if (at !== null && at.derived) (at.local ??= new Set()).add(source);
}

export function local(source: Source): boolean {
	const at = top();
	return at !== null && at.local !== null && at.local.has(source);
}

export function guard(source: Source): void {
	const at = frame ?? top();
	if (at === null || !(frame === null ? at.eager : at.guarded)) return;
	if (at.local === null || !at.local.has(source)) unsafeMutation();
}

function record(at: Frame, source: Source): void {
	source.read = at.version;
	const old = at.old;
	if (at.extra === null && old !== null && at.matched < old.length && old[at.matched] === source)
		at.matched++;
	else (at.extra ??= []).push(source);
}

function readBy(at: Frame, source: Source): boolean {
	if (source.read === at.version) return true;
	const old = at.old;
	if (old !== null)
		for (let index = 0; index < at.matched; index++) if (old[index] === source) return true;
	return at.extra !== null && at.extra.includes(source);
}

function reads(at: Frame): Source[] {
	const found = at.old === null ? [] : at.old.slice(0, at.matched);
	if (at.extra !== null) found.push(...at.extra);
	return found;
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
let executing: Reaction | null = null;
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
	const at = frame;
	if (DEV && tracing !== null) traced(source, at?.target ?? null);
	if (at !== null && source.read !== at.version && (at.local === null || !at.local.has(source)))
		record(at, source);
	if (past !== null) return recall(source, past) as T;
	if (view !== null) return through(source, view) as T;
	if (isDerived(source)) return settled(source) as T;
	return source.v;
}

function settled(derived: Derived): unknown {
	refresh(derived);
	const failure = derived.failure;
	if (failure !== null) throw failure.error;
	return derived.v;
}

export function reading(): boolean {
	return frame !== null;
}

export function running(): Reaction | null {
	return executing;
}

export function withoutReaction<T>(fn: () => T): T {
	const previous = executing;
	executing = null;
	try {
		return untrack(fn);
	} finally {
		executing = previous;
	}
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
	destroyEffects(derived);
	const previous = frame;
	const previousReaction = executing;
	executing = derived;
	const current = opened(derived);
	const previousOwner = setOwner(derived.owner);
	try {
		const value = derived.fn();
		if (DEV) computed(derived, value, given.batch);
		return value;
	} finally {
		if (DEV) tracedRun(derived, now());
		closed(previous);
		executing = previousReaction;
		setOwner(previousOwner);
		const deps = (derived.deps ??= []);
		const extra = current.extra ?? [];
		if (deps.length === 0 && extra.length > 0) own(derived);
		for (const dep of extra) {
			if (deps.includes(dep)) continue;
			deps.push(dep);
			subscribe(dep, derived);
		}
		if (current.hidden !== null) {
			given.reached.set(derived, current.hidden);
			note(current.hidden);
		}
		finished(current);
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
		if (!given.values.has(source)) {
			if (source.failure !== null) throw source.failure.error;
			return source.v;
		}
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
	const previousReaction = executing;
	past = { before, later, written: null, derived: null };
	frame = null;
	executing = null;
	try {
		fn.call(null);
	} finally {
		past = previousPast;
		frame = previousFrame;
		executing = previousReaction;
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
		return settled(source);
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
	for (let index = depth - 1; index >= 0; index--) {
		const current = frames[index] as Frame;
		if (!current.invalidated && readBy(current, source)) current.invalidated = true;
	}
}

function own(derived: Derived): void {
	const holder = derived.owner;
	if (holder !== null) (holder.owned ??= []).push(derived);
}

function reconcile(target: Reaction, current: Frame, keep: boolean): void {
	const previous = target.deps;
	const old = current.old;
	const extra = current.extra;
	const matched = current.matched;
	if (old === previous && extra === null) {
		if (old === null) target.deps = [];
		else if (!keep && matched < old.length) {
			for (let index = matched; index < old.length; index++)
				unsubscribe(old[index] as Source, target);
			old.length = matched;
		}
		return;
	}
	if (old === previous && extra !== null) {
		const taken = current.version + 2;
		const tail = current.version + 1;
		const empty = old === null || old.length === 0;
		if (old !== null) {
			for (let index = 0; index < matched; index++) (old[index] as Source).read = taken;
			for (let index = matched; index < old.length; index++) (old[index] as Source).read = tail;
		}
		let count = 0;
		for (let index = 0; index < extra.length; index++) {
			const dep = extra[index] as Source;
			const mark = dep.read;
			if (mark === taken) continue;
			dep.read = taken;
			if (mark !== tail) subscribe(dep, target);
			else if (keep) continue;
			extra[count++] = dep;
		}
		extra.length = count;
		if (old === null) target.deps = extra;
		else if (keep) for (const dep of extra) old.push(dep);
		else {
			for (let index = matched; index < old.length; index++) {
				const dep = old[index] as Source;
				if (dep.read === tail) unsubscribe(dep, target);
			}
			if (matched === 0) target.deps = extra;
			else {
				old.length = matched;
				for (const dep of extra) old.push(dep);
			}
		}
		if (empty && count > 0 && isDerived(target)) own(target);
		return;
	}
	const kept = new Set(reads(current));
	const subscribed = new Set(previous);
	for (const dep of subscribed) {
		if (keep) kept.add(dep);
		else if (!kept.has(dep)) unsubscribe(dep, target);
	}
	for (const dep of kept) if (!subscribed.has(dep)) subscribe(dep, target);
	target.deps = [...kept];
	if ((previous === null || previous.length === 0) && kept.size > 0 && isDerived(target))
		own(target);
}

function dirtyRead(dep: Source): boolean {
	return isDerived(dep) && dep.status !== CLEAN && (view === null || !view.values.has(dep));
}

export function track<T>(target: Reaction, fn: () => T): T {
	const previous = frame;
	const previousReaction = executing;
	executing = target;
	const current = opened(target);
	try {
		return fn();
	} finally {
		closed(previous);
		executing = previousReaction;
		hiddenByLast = current.hidden;
		if ((target as Effect).destroyed === true) target.deps = null;
		else settleRun(target, current);
		if (DEV) tracedRun(target, target.status === DIRTY ? current.started : now());
		finished(current);
	}
}

function settleRun(target: Reaction, current: Frame): void {
	let invalidated = current.invalidated;
	const old = current.old;
	if (old !== null)
		for (let index = 0; !invalidated && index < current.matched; index++)
			if (dirtyRead(old[index] as Source)) invalidated = true;
	if (!invalidated && current.extra !== null)
		for (const dep of current.extra) if (dirtyRead(dep)) invalidated = true;
	reconcile(target, current, view !== null && (view.batch.fork || current.hidden !== null));
	target.rv = now();
	target.status = invalidated ? DIRTY : CLEAN;
}

export function takeHidden(): Set<Batch> | null {
	const found = hiddenByLast;
	hiddenByLast = null;
	return found;
}

export function stale(target: Reaction): boolean {
	const status = target.status;
	if (status === DIRTY) return true;
	if (status === MAYBE) {
		const deps = target.deps;
		if (deps !== null) {
			for (let index = 0; index < deps.length; index++) {
				const dep = deps[index] as Source;
				if (isDerived(dep)) {
					if (view !== null) {
						if (affected(dep, view)) return true;
						refresh(dep);
						if (view.values.has(dep)) return true;
					} else if (dep.status !== CLEAN) refresh(dep);
				}
				if (dep.wv > target.rv) return true;
			}
		}
		target.status = CLEAN;
	}
	return false;
}

export function refresh(derived: Derived): void {
	if (derived.deps !== null && !stale(derived)) return;
	if (view !== null && affected(derived, view)) return;
	destroyEffects(derived);
	const previous = setOwner(derived.owner);
	try {
		let value: unknown;
		try {
			value = track(derived, derived.fn);
		} catch (error) {
			hiddenByLast = null;
			derived.computed = false;
			derived.wv = stamp();
			const holder = derived.owner;
			if (holder === null) {
				derived.failure = { error };
				return;
			}
			derived.v = undefined as typeof derived.v;
			if (holder.destroyed) return;
			const status = derived.status;
			derived.status = DIRTY;
			fail(holder, error);
			derived.status = status;
			return;
		}
		if (derived.failure !== null) derived.failure = null;
		const hidden = hiddenByLast;
		hiddenByLast = null;
		if (hidden !== null && view !== null) {
			derived.status = DIRTY;
			view.values.set(derived, value);
			view.reached.set(derived, hidden);
			view.checked.set(derived, true);
			return;
		}
		if (!derived.computed || !equal(derived, derived.v, value)) {
			derived.v = value;
			derived.wv = stamp();
			derived.computed = true;
			if (DEV) updated(derived);
		}
	} finally {
		setOwner(previous);
	}
}

export function disconnect(derived: Derived): void {
	destroyEffects(derived);
	for (const dep of derived.deps ?? []) unsubscribe(dep, derived);
	derived.deps = null;
	derived.status = DIRTY;
}
