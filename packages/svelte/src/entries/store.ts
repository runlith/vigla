import { untrack } from 'vigla/internal/index-client';
import type { Subscribable } from 'vigla';

export type Subscriber<T> = (value: T) => void;
export type Unsubscriber = () => void;
export type Updater<T> = (value: T) => T;
export type StartStopNotifier<T> = (
	set: (value: T) => void,
	update: (fn: Updater<T>) => void
) => void | Unsubscriber;

export interface Readable<T> extends Subscribable<T> {
	subscribe(this: void, run: Subscriber<T>, invalidate?: () => void): Unsubscriber;
	subscribeSync?(run: Subscriber<T>): Unsubscriber;
}

export interface Writable<T> extends Readable<T> {
	set(this: void, value: T): void;
	update(this: void, updater: Updater<T>): void;
}

interface Subscription<T> {
	readonly run: Subscriber<T>;
	readonly invalidate: () => void;
	readonly sync: boolean;
	version: number;
}

export type Stores = Readable<unknown> | readonly Readable<unknown>[];
export type StoresValues<S> =
	S extends Readable<infer T> ? T : { [K in keyof S]: S[K] extends Readable<infer T> ? T : never };

const notifications: (() => void)[] = [];
let publishing = false;
const noop = (): void => {};

function changed<T>(before: T, after: T): boolean {
	return before !== before
		? after === after
		: before !== after ||
				(before !== null && typeof before === 'object') ||
				typeof before === 'function';
}

export function subscribe<T>(
	store: Readable<T> | null | undefined,
	run: Subscriber<T>,
	invalidate?: () => void,
	sync = false
): Unsubscriber {
	if (store == null) {
		run(undefined as T);
		invalidate?.();
		return noop;
	}
	const release = untrack(() =>
		sync && store.subscribeSync ? store.subscribeSync(run) : store.subscribe(run, invalidate)
	);
	return typeof release === 'function'
		? release
		: () => (release as { unsubscribe(): void }).unsubscribe();
}

export function writable<T = undefined>(value?: T, start?: StartStopNotifier<T>): Writable<T> {
	let current = value as T;
	let stop: Unsubscriber | undefined;
	let version = 0;
	const subscribers = new Set<Subscription<T>>();
	const set = (next: T): void => {
		if (!changed(current, next)) return;
		current = next;
		if (stop === undefined) return;
		const publication = ++version;
		const drain = !publishing;
		publishing = true;
		try {
			for (const subscriber of subscribers) {
				subscriber.invalidate();
				if (!subscriber.sync) {
					const value = current;
					notifications.push(() => subscriber.run(value));
				}
			}
			for (const subscriber of subscribers) {
				if (subscriber.sync && subscriber.version < publication) {
					subscriber.version = publication;
					subscriber.run(current);
				}
			}
			if (drain) {
				for (let index = 0; index < notifications.length; index++) notifications[index]?.();
			}
		} finally {
			if (drain) {
				notifications.length = 0;
				publishing = false;
			}
		}
	};
	const update = (fn: Updater<T>): void => set(fn(current));
	const listen = (run: Subscriber<T>, invalidate: () => void, sync: boolean): Unsubscriber => {
		const subscriber = { run, invalidate, sync, version };
		subscribers.add(subscriber);
		if (subscribers.size === 1) stop = start?.(set, update) || noop;
		run(current);
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop !== undefined) {
				stop();
				stop = undefined;
			}
		};
	};
	return {
		set,
		update,
		subscribe: (run, invalidate = noop) => listen(run, invalidate, false),
		subscribeSync: (run) => listen(run, noop, true)
	};
}

export function readable<T = undefined>(value?: T, start?: StartStopNotifier<T>): Readable<T> {
	const store = writable(value, start);
	return { subscribe: store.subscribe, subscribeSync: store.subscribeSync };
}

export function derived<S extends Stores, T>(
	stores: S,
	fn: (
		values: StoresValues<S>,
		set: (value: T) => void,
		update: (fn: Updater<T>) => void
	) => Unsubscriber | void,
	initial?: T
): Readable<T>;
export function derived<S extends Stores, T>(
	stores: S,
	fn: (values: StoresValues<S>) => T,
	initial?: T
): Readable<T>;
export function derived<S extends Stores, T>(
	stores: S,
	fn: (
		values: StoresValues<S>,
		set: (value: T) => void,
		update: (fn: Updater<T>) => void
	) => T | Unsubscriber | void,
	initial?: T
): Readable<T> {
	const inputs: readonly Readable<unknown>[] = Array.isArray(stores)
		? stores
		: [stores as Readable<unknown>];
	if (inputs.some((input) => !input))
		throw new Error('derived() expects stores as input, got a falsy value');
	return readable(initial, (set, update) => {
		const values: unknown[] = [];
		const pending = new Set<number>();
		let active = false;
		let cleanup: Unsubscriber = noop;
		const sync = (): void => {
			if (pending.size > 0) return;
			cleanup();
			const value = (Array.isArray(stores) ? values : values[0]) as StoresValues<S>;
			const result = fn(value, set, update);
			if (fn.length < 2) set(result as T);
			else cleanup = typeof result === 'function' ? (result as Unsubscriber) : noop;
		};
		const releases = inputs.map((input, index) =>
			subscribe(
				input,
				(value) => {
					values[index] = value;
					pending.delete(index);
					if (active) sync();
				},
				() => pending.add(index)
			)
		);
		active = true;
		sync();
		return () => {
			for (const release of releases) release();
			cleanup();
			active = false;
		};
	});
}

export function readonly<T>(store: Readable<T>): Readable<T> {
	const sync = store.subscribeSync;
	return {
		subscribe: (run, invalidate) => store.subscribe(run, invalidate),
		...(sync ? { subscribeSync: (run: Subscriber<T>) => sync.call(store, run) } : {})
	};
}

export function get<T>(store: Readable<T>): T {
	let value: T;
	subscribe(store, (current) => (value = current))();
	return value!;
}
