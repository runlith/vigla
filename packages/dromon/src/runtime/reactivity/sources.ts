import { write } from './batch.ts';
import { own } from './effects.ts';
import { DIRTY, type Derived, type Source } from './graph.ts';
import { get, owner } from './tracking.ts';

export function state<T>(value: T): Source<T> {
	return { v: value, wv: 0, reactions: null };
}

export function set<T>(source: Source<T>, value: T): T {
	return write(source, value);
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
	const source = state(value);
	return {
		get current() {
			return get(source);
		},
		set current(next) {
			set(source, next);
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
		status: DIRTY,
		deps: null,
		rv: 0
	};
	own(created);
	return created;
}
