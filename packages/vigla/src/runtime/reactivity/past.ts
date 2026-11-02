import { isDerived, type Derived, type Source } from './graph.ts';
import { withoutLeaving } from './leaving.ts';
import { settled, through, view, withoutReaction } from './tracking.ts';

export const NONE: unique symbol = Symbol('none');

export type Prior = (source: Source) => unknown;

export interface Past {
	readonly before: Prior;
	readonly later: Prior | null;
	written: Set<Source> | null;
	derived: Map<Derived, unknown> | null;
}

export let past: Past | null = null;

export function setPast(next: Past | null): Past | null {
	const previous = past;
	past = next;
	return previous;
}

export function recalling(before: Prior, later: Prior | null, fn: () => void): void {
	const previous = setPast({ before, later, written: null, derived: null });
	try {
		withoutReaction(() => fn.call(null));
	} finally {
		past = previous;
	}
}

export function presently(fn: () => void): void {
	const previous = setPast(null);
	try {
		withoutLeaving(fn);
	} finally {
		past = previous;
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

export function recall(source: Source, given: Past): unknown {
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
