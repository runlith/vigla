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

interface Past {
	readonly before: Map<Source, unknown>;
	readonly later: Map<Source, unknown> | null;
	written: Set<Source> | null;
	derived: Map<Derived, unknown> | null;
}

let reads: Source[] | null = null;
let invalidated = false;
let past: Past | null = null;

export let owner: Effect | null = null;

export function setOwner(effect: Effect | null): Effect | null {
	const previous = owner;
	owner = effect;
	return previous;
}

export function get<T>(source: Source<T>): T {
	if (reads !== null) reads.push(source);
	if (past !== null) return recall(source, past) as T;
	if (isDerived(source)) refresh(source);
	return source.v;
}

export function reading(): boolean {
	return reads !== null;
}

export function untrack<T>(fn: () => T): T {
	const previous = reads;
	reads = null;
	try {
		return fn();
	} finally {
		reads = previous;
	}
}

export function recalling(
	before: Map<Source, unknown>,
	later: Map<Source, unknown> | null,
	fn: () => void
): void {
	const previousPast = past;
	const previousReads = reads;
	past = { before, later, written: null, derived: null };
	reads = null;
	try {
		fn();
	} finally {
		past = previousPast;
		reads = previousReads;
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
	if (!isDerived(source)) return source.v;
	if (given.derived !== null && given.derived.has(source)) return given.derived.get(source);
	if (!dated(source, given)) {
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
	if (reads !== null && reads.includes(source)) invalidated = true;
}

function reconcile(target: Reaction, next: Source[]): void {
	const kept = new Set(next);
	for (const dep of target.deps ?? []) {
		if (!kept.has(dep)) dep.reactions?.delete(target);
	}
	for (const dep of kept) (dep.reactions ??= new Set()).add(target);
	target.deps = [...kept];
}

export function track<T>(target: Reaction, fn: () => T): T {
	const previousReads = reads;
	const previousInvalidated = invalidated;
	reads = [];
	invalidated = false;
	try {
		return fn();
	} finally {
		for (const dep of reads) if (isDerived(dep) && dep.status !== CLEAN) invalidated = true;
		reconcile(target, reads);
		target.rv = now();
		target.status = invalidated ? DIRTY : CLEAN;
		reads = previousReads;
		invalidated = previousInvalidated;
	}
}

export function stale(target: Reaction): boolean {
	if (target.status === DIRTY) return true;
	if (target.status === MAYBE) {
		for (const dep of target.deps ?? []) {
			if (isDerived(dep)) refresh(dep);
			if (dep.wv > target.rv) return true;
		}
		target.status = CLEAN;
	}
	return false;
}

export function refresh(derived: Derived): void {
	if (derived.deps !== null && !stale(derived)) return;
	const previous = setOwner(derived.owner);
	try {
		const value = track(derived, derived.fn);
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
