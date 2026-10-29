import {
	CLEAN,
	DIRTY,
	MAYBE,
	isDerived,
	now,
	tick,
	type Derived,
	type Effect,
	type Reaction,
	type Source
} from './graph.ts';

let reaction: Reaction | null = null;
let reads: Source[] | null = null;
let invalidated = false;

export let owner: Effect | null = null;

export function setOwner(effect: Effect | null): Effect | null {
	const previous = owner;
	owner = effect;
	return previous;
}

export function get<T>(source: Source<T>): T {
	if (reads !== null) reads.push(source);
	if (isDerived(source)) refresh(source);
	return source.v;
}

export function untrack<T>(fn: () => T): T {
	const previousReaction = reaction;
	const previousReads = reads;
	reaction = null;
	reads = null;
	try {
		return fn();
	} finally {
		reaction = previousReaction;
		reads = previousReads;
	}
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
	const previousReaction = reaction;
	const previousReads = reads;
	const previousInvalidated = invalidated;
	reaction = target;
	reads = [];
	invalidated = false;
	try {
		return fn();
	} finally {
		reconcile(target, reads);
		target.rv = now();
		target.status = invalidated ? DIRTY : CLEAN;
		reaction = previousReaction;
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
			derived.wv = tick();
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
