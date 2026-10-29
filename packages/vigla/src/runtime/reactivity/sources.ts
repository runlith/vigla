import { write } from './batch.ts';
import { DIRTY, type Derived, type Source } from './graph.ts';
import { get, guard, localize, owner } from './tracking.ts';

export function source<T>(value: T): Source<T> {
	return { v: value, wv: 0, reactions: null, logged: 0, slot: 0 };
}

export function state<T>(value: T): Source<T> {
	const created = source(value);
	localize(created);
	return created;
}

export function set<T>(target: Source<T>, value: T): T {
	guard(target);
	return write(target, value);
}

function step<T extends number | bigint>(value: T, delta: number): T {
	return (typeof value === 'bigint' ? value + BigInt(delta) : (value as number) + delta) as T;
}

export function update<T extends number | bigint>(source: Source<T>, delta = 1): T {
	const value = get(source);
	set(source, step(value, delta));
	return value;
}

export function updatePre<T extends number | bigint>(source: Source<T>, delta = 1): T {
	return set(source, step(get(source), delta));
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

export function derived<T>(fn: () => T): Derived<T> {
	const created: Derived<T> = {
		fn,
		owner,
		computed: false,
		v: undefined as T,
		wv: 0,
		reactions: null,
		logged: 0,
		slot: 0,
		status: DIRTY,
		deps: null,
		rv: 0
	};
	return created;
}
