import { untrack } from 'vigla/internal/index-client';

export type Subscriber<T> = (value: T) => void;
export type Unsubscriber = () => void;
export type Updater<T> = (value: T) => T;
export type StartStopNotifier<T> = (
	set: (value: T) => void,
	update: (fn: Updater<T>) => void
) => void | Unsubscriber;

export interface Readable<T> {
	subscribe(this: void, run: Subscriber<T>, invalidate?: () => void): Unsubscriber;
}

export interface Writable<T> extends Readable<T> {
	set(this: void, value: T): void;
	update(this: void, updater: Updater<T>): void;
}

interface Subscription<T> {
	readonly run: Subscriber<T>;
	readonly invalidate: () => void;
}

export type Stores = Readable<unknown> | readonly Readable<unknown>[];
export type StoresValues<S> =
	S extends Readable<infer T> ? T : { [K in keyof S]: S[K] extends Readable<infer T> ? T : never };

const notifications: (() => void)[] = [];
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
	invalidate?: () => void
): Unsubscriber {
	if (store == null) {
		run(undefined as T);
		invalidate?.();
		return noop;
	}
	const release = untrack(() => store.subscribe(run, invalidate));
	return typeof release === 'function'
		? release
		: () => (release as { unsubscribe(): void }).unsubscribe();
}

export function writable<T = undefined>(value?: T, start?: StartStopNotifier<T>): Writable<T> {
	let current = value as T;
	let stop: Unsubscriber | undefined;
	const subscribers = new Set<Subscription<T>>();
	const set = (next: T): void => {
		if (!changed(current, next)) return;
		current = next;
		if (stop === undefined) return;
		const drain = notifications.length === 0;
		for (const subscriber of subscribers) {
			subscriber.invalidate();
			const value = current;
			notifications.push(() => subscriber.run(value));
		}
		if (drain) {
			for (let index = 0; index < notifications.length; index++) notifications[index]?.();
			notifications.length = 0;
		}
	};
	const update = (fn: Updater<T>): void => set(fn(current));
	return {
		set,
		update,
		subscribe(run, invalidate = noop) {
			const subscriber = { run, invalidate };
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
		}
	};
}

export function readable<T = undefined>(value?: T, start?: StartStopNotifier<T>): Readable<T> {
	return { subscribe: writable(value, start).subscribe };
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
	return { subscribe: (run, invalidate) => store.subscribe(run, invalidate) };
}

export function get<T>(store: Readable<T>): T {
	let value: T;
	subscribe(store, (current) => (value = current))();
	return value!;
}
