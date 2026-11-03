import { write } from './scheduler.ts';
import { ownDerived } from './drafts.ts';
import {
	DERIVED,
	DIRTY,
	SOURCE,
	isDerived,
	retainFailures,
	type Derived,
	type Source
} from './graph.ts';
import { get, refresh } from './reads.ts';
import { sequence } from './history.ts';
import { guard, localize, marked, owner, present, untrack, view } from './tracking.ts';

export function source<T>(value: T): Source<T> {
	return {
		kind: SOURCE,
		v: value,
		wv: 0,
		reactions: null,
		logged: 0,
		slot: 0,
		read: 0,
		links: null
	};
}

export function mutableEqual(before: unknown, after: unknown): boolean {
	return (
		(before === after || (before !== before && after !== after)) &&
		(before === null || (typeof before !== 'object' && typeof before !== 'function'))
	);
}

export function mutableSource<T>(value: T): Source<T> {
	return { ...source(value), equals: mutableEqual };
}

export function state<T>(value: T): Source<T> {
	const created = source(value);
	localize(created);
	return created;
}

export function expire(target: Source): void {
	for (const reaction of target.reactions ?? []) {
		if (!isDerived(reaction)) continue;
		reaction.status = DIRTY;
		marked();
	}
}

export function set<T>(target: Source<T>, value: T): T {
	guard(target);
	const batch = view?.batch.fork ? view.batch : null;
	let reads: ReadonlyMap<Source, unknown> | undefined;
	if (isDerived(target)) {
		if (batch !== null) {
			present(() => refresh(target));
			reads = untrack(() => new Map((target.deps ?? []).map((dep) => [dep, get(dep)])));
		} else {
			refresh(target);
			target.failure = null;
		}
	}
	const result = write(target, value, sequence());
	if (batch !== null && reads !== undefined) {
		const origin = batch.origins!.get(target)!;
		batch.origins!.set(target, { ...origin, reads });
	}
	return result;
}

export function update<T extends number | bigint>(source: Source<T>, delta: 1 | -1 = 1): T {
	let value: number | bigint = get(source);
	const result = delta === 1 ? value++ : value--;
	set(source, value as T);
	return result as T;
}

export function updatePre<T extends number | bigint>(source: Source<T>, delta: 1 | -1 = 1): T {
	let value: number | bigint = get(source);
	return set(source, (delta === 1 ? ++value : --value) as T);
}

export interface Cell<T> {
	current: T;
}

export function cell<T>(value: T): Cell<T> {
	return valueCell(state(value));
}

export function memo<T>(fn: () => T, equals?: (before: T, after: T) => boolean): Cell<T> {
	const created = derived(fn, equals);
	retainFailures(created);
	return valueCell(created);
}

function valueCell<T>(held: Source<T>): Cell<T> {
	return {
		get current() {
			return get(held);
		},
		set current(next) {
			set(held, next);
		}
	};
}

export function lapsingDerived<T>(
	fn: () => T,
	equals?: (before: T, after: T) => boolean
): Derived<T> {
	const created = derived(fn, equals);
	created.lapses = true;
	return created;
}

export function derived<T>(fn: () => T, equals?: (before: T, after: T) => boolean): Derived<T> {
	const created: Derived<T> = {
		kind: DERIVED,
		status: DIRTY,
		reactions: null,
		deps: null,
		wv: 0,
		rv: 0,
		v: undefined as T,
		fn,
		owner,
		effects: null,
		frozen: null,
		failure: null,
		computed: false,
		lapses: false,
		logged: 0,
		slot: 0,
		read: 0,
		slots: null,
		links: null,
		captured: null
	};
	if (equals !== undefined) created.equals = equals;
	if (owner !== null) {
		owner.preserved = true;
		ownDerived(created);
	}
	return created;
}
