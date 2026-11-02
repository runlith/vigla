import { failure } from './diagnostics.ts';

export interface Subscription {
	unsubscribe(): void;
}

export interface Subscribable<T> {
	subscribe(run: (value: T) => void): (() => void) | Subscription;
	subscribeSync?(run: (value: T) => void): (() => void) | Subscription;
}

export interface WritableSource<T> extends Subscribable<T> {
	set(value: T): void;
}

export interface External<T> {
	readonly current: T;
	readonly peek: T;
	refresh(): void;
	dispose(): void;
}

export interface WritableExternal<T> extends External<T> {
	current: T;
}

export interface Connected<T> {
	current: T;
	readonly peek: T;
	refresh<R>(result: R): R;
	mutate<R>(result: R): R;
	dispose(): void;
}

export function expose<T>(connected: Connected<T>): WritableExternal<T> {
	return {
		get current() {
			return connected.current;
		},
		set current(value: T) {
			connected.current = value;
		},
		get peek() {
			return connected.peek;
		},
		refresh() {
			connected.refresh(undefined);
		},
		dispose() {
			connected.dispose();
		}
	};
}

export class Connection<T> {
	#source: Subscribable<T> | null | undefined;
	#release: (() => void) | undefined;
	#closed = false;
	#selected = false;
	readonly #notify: (before: T, value: T) => void;
	value: T = undefined as T;

	constructor(notify: (before: T, value: T) => void = () => {}) {
		this.#notify = notify;
	}

	select(source: Subscribable<T> | null | undefined, name: string, reset = false): void {
		if (this.#selected && source === this.#source && !this.#closed) return;
		this.disconnect();
		if (source != null && typeof source.subscribe !== 'function') {
			throw failure(
				'source_invalid',
				`\`${name}\` is not a subscribable source with a \`subscribe\` method`,
				{ name }
			);
		}
		this.#source = source;
		this.#selected = true;
		if (reset) this.value = undefined as T;
		if (source == null) {
			this.value = undefined as T;
			return;
		}
		let synchronous = true;
		const subscribe = source.subscribeSync ?? source.subscribe;
		const subscription = subscribe.call(source, (value) => {
			const before = this.value;
			this.value = value;
			if (!synchronous) this.#notify(before, value);
		});
		synchronous = false;
		const release =
			typeof subscription === 'function' ? subscription : () => subscription.unsubscribe();
		if (this.#closed) release();
		else this.#release = release;
	}

	refresh(source: Subscribable<T> | null | undefined): void {
		if (source !== this.#source) this.disconnect();
	}

	disconnect(): void {
		const release = this.#release;
		this.#release = undefined;
		this.#selected = false;
		release?.();
	}

	dispose(): void {
		this.#closed = true;
		this.disconnect();
	}
}
