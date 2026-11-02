import { failure } from '../../shared/diagnostics.ts';
import type { Effect } from './graph.ts';
import { owner } from './tracking.ts';

export interface AsyncStore {
	run<R>(value: unknown, fn: () => R): R;
	getStore(): unknown;
}

type Frame = readonly unknown[];

const empty: Frame = [];
export let port: AsyncStore | null = null;
let slots = 1;

export function carryAcrossAwait(store: AsyncStore): void {
	if (port === store) return;
	if (port !== null) {
		throw failure(
			'async_store_conflict',
			'A different async store already carries values across `await` in this realm'
		);
	}
	port = store;
}

function frame(store: AsyncStore): Frame {
	return (store.getStore() as Frame | undefined) ?? empty;
}

function within<R>(store: AsyncStore, slot: number, value: unknown, fn: () => R): R {
	const next = frame(store).slice();
	next[slot] = value;
	return store.run(next, fn);
}

export function carry<R>(effect: Effect, fn: () => R): R {
	return port === null ? fn() : within(port, 0, effect, fn);
}

export function ambient(): Effect | null {
	if (owner !== null || port === null) return owner;
	return (frame(port)[0] as Effect | undefined) ?? null;
}

export class AsyncVariable<T> {
	readonly #slot = slots++;
	#value: T | undefined;

	run<R>(value: T, fn: () => R): R {
		if (port !== null) return within(port, this.#slot, value, fn);
		const previous = this.#value;
		this.#value = value;
		try {
			return fn();
		} finally {
			this.#value = previous;
		}
	}

	get(): T | undefined {
		return port === null ? this.#value : (frame(port)[this.#slot] as T | undefined);
	}
}
