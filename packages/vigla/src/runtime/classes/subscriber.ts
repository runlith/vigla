import { template, tracking } from '../reactivity/effects.ts';
import type { Source } from '../reactivity/graph.ts';
import { set, source } from '../reactivity/sources.ts';
import { get, untrack } from '../reactivity/tracking.ts';

export type Start = (update: () => void) => (() => void) | void;

export function bump(source: Source<number>): void {
	set(source, source.v + 1);
}

export function createSubscriber(start: Start): () => void {
	const version = source(0);
	let subscribers = 0;
	let stop: (() => void) | void;
	const update = (): void => bump(version);
	const release = (): void => {
		subscribers -= 1;
		if (subscribers > 0) return;
		const stopping = stop;
		stop = undefined;
		stopping?.();
		update();
	};
	return () => {
		if (!tracking()) return;
		get(version);
		template(() => {
			if (subscribers === 0) stop = untrack(() => start(update));
			subscribers += 1;
			return () => queueMicrotask(release);
		});
	};
}

export class Subscribed<T> {
	readonly #read: () => T;
	readonly #subscribe: () => void;

	constructor(read: () => T, start: Start) {
		this.#read = read;
		this.#subscribe = createSubscriber(start);
	}

	get current(): T {
		this.#subscribe();
		return this.#read();
	}
}
