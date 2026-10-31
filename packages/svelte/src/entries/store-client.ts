import { getOwner } from 'vigla/internal/index-client';
import { effectRoot, template, tracking } from 'vigla/internal/client';
import { createSubscriber } from 'vigla/internal/reactivity-client';
import { get, subscribe, writable, type Readable, type Writable } from './store.ts';

export { derived, get, readable, readonly, writable } from './store.ts';
export type {
	Readable,
	StartStopNotifier,
	Subscriber,
	Unsubscriber,
	Updater,
	Writable
} from './store.ts';

export function toStore<T>(read: () => T, write: (value: T) => void): Writable<T>;
export function toStore<T>(read: () => T): Readable<T>;
export function toStore<T>(read: () => T, write?: (value: T) => void): Readable<T> | Writable<T> {
	const owner = getOwner();
	const initial = read();
	const store = writable(initial, (publish) => {
		let ran = initial !== read();
		const start = (): (() => void) =>
			effectRoot(() => {
				template(() => {
					const value = read();
					if (ran) publish(value);
				});
			});
		const stop = owner !== null && !owner.disposed ? owner.run(start) : start();
		ran = true;
		return stop;
	});
	return write === undefined
		? { subscribe: store.subscribe }
		: { subscribe: store.subscribe, set: write, update: (fn) => write(fn(read())) };
}

export function fromStore<T>(store: Writable<T>): { current: T };
export function fromStore<T>(store: Readable<T>): { readonly current: T };
export function fromStore<T>(store: Readable<T>): { readonly current: T } {
	let value: T;
	const track = createSubscriber((update) => {
		let active = false;
		const release = subscribe(store, (next) => {
			value = next;
			if (active) update();
		});
		active = true;
		return release;
	});
	const read = (): T => {
		if (!tracking()) return get(store);
		track();
		return value;
	};
	return 'set' in store
		? {
				get current() {
					return read();
				},
				set current(value: T) {
					(store as Writable<T>).set(value);
				}
			}
		: {
				get current() {
					return read();
				}
			};
}
