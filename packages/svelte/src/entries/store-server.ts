import { get, writable, type Readable, type Writable } from './store.ts';

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
	const store = writable(read());
	return write === undefined
		? { subscribe: store.subscribe }
		: { subscribe: store.subscribe, set: write, update: (fn) => write(fn(read())) };
}

export function fromStore<T>(store: Writable<T>): { current: T };
export function fromStore<T>(store: Readable<T>): { readonly current: T };
export function fromStore<T>(store: Readable<T>): { readonly current: T } {
	return 'set' in store
		? {
				get current() {
					return get(store);
				},
				set current(value: T) {
					(store as Writable<T>).set(value);
				}
			}
		: {
				get current() {
					return get(store);
				}
			};
}
