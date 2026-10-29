import { write } from './batch.ts';
import { own } from './effects.ts';
import { DIRTY, type Derived, type Source } from './graph.ts';
import { owner } from './tracking.ts';

export function state<T>(value: T): Source<T> {
	return { v: value, wv: 0, reactions: null };
}

export function set<T>(source: Source<T>, value: T): T {
	return write(source, value);
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
