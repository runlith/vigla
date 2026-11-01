import { write } from './batch.ts';
import { DERIVED, DIRTY, SOURCE, isDerived, type Derived, type Source } from './graph.ts';
import { refresh } from './deriveds.ts';
import { get, guard, localize, owner } from './tracking.ts';

export function source<T>(value: T): Source<T> {
	return { kind: SOURCE, v: value, wv: 0, reactions: null, logged: 0, slot: 0, read: 0 };
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

export function set<T>(target: Source<T>, value: T): T {
	guard(target);
	if (isDerived(target)) {
		refresh(target);
		target.failure = null;
	}
	return write(target, value);
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
	const held = state(value);
	return {
		get current() {
			return get(held);
		},
		set current(next) {
			set(held, next);
		}
	};
}

export function derived<T>(fn: () => T, equals?: (before: T, after: T) => boolean): Derived<T> {
	const created: Derived<T> = {
		kind: DERIVED,
		fn,
		owner,
		effects: null,
		frozen: null,
		failure: null,
		computed: false,
		v: undefined as T,
		wv: 0,
		reactions: null,
		logged: 0,
		slot: 0,
		read: 0,
		status: DIRTY,
		deps: null,
		rv: 0
	};
	if (equals !== undefined) created.equals = equals;
	return created;
}
