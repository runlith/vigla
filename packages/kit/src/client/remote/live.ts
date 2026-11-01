import { cell, getOwner, untrack } from 'vigla';
import type { RemoteLiveQuery, RemoteLiveQueryFunction } from '../../types/remote.ts';
import type { RemoteNode } from '../../types/internal/remote.ts';
import { encodeArgument, getRemoteKey } from '../../shared/remote.ts';
import { HttpError, Redirect } from '../../shared/outcomes.ts';
import { client, currentClient } from '../client.ts';
import { DEV } from 'esm-env';
import type { Remotes } from './cache.ts';
import { Result } from './result.ts';
import { queryId, resourceKey } from './updates.ts';

interface Emission<T> {
	value: T;
}
interface Failure {
	error: unknown;
}

interface Subscriber<T> {
	pending?: Emission<T>;
	waiting?: PromiseWithResolvers<IteratorResult<T>>;
	error?: Failure;
	done: boolean;
}

export class LiveQuery<T> extends Result<T> implements AsyncIterable<T> {
	readonly #remotes: Remotes;
	readonly #id: string;
	readonly #payload: string;
	readonly #transient: boolean;
	readonly #connected = cell(false);
	readonly #done = cell(false);
	readonly #subscribers = new Set<Subscriber<T>>();
	#controller?: AbortController;
	#running?: Promise<void>;
	#reconnecting?: Promise<void>;
	#delay?: ReturnType<typeof setTimeout>;
	#wake?: () => void;
	#started = false;
	#disposed = false;
	#attempt = 0;
	#terminal?: Failure;

	constructor(
		remotes: Remotes,
		id: string,
		payload: string,
		seed: RemoteNode | Promise<RemoteNode> | undefined,
		transient: boolean
	) {
		super();
		this.#remotes = remotes;
		this.#id = id;
		this.#payload = payload;
		this.#transient = transient;
		if (seed instanceof Promise) {
			const request = this.begin();
			void seed.then(
				(node) => {
					if (this.pending(request)) {
						if (node.e) super.fail(new HttpError(node.e), request);
						else this.set(node.v, request);
					}
				},
				async (error) => super.fail(await remotes.error(error), request)
			);
		} else if (seed) {
			if (seed.e) super.fail(new HttpError(seed.e));
			else super.set(seed.v);
		}
	}

	override start(): void {
		if (this.#started || this.#disposed) return;
		if (this.#transient && this.#subscribers.size === 0 && untrack(() => this.available.current))
			return;
		this.#started = true;
		window.addEventListener('online', this.#resume);
		window.addEventListener('offline', this.#pause);
		window.addEventListener('pagehide', this.#pause);
		window.addEventListener('beforeunload', this.#pause);
		window.addEventListener('pageshow', this.#show);
		if (untrack(() => this.promise.current) === undefined)
			this.#remotes.owner.run(() => this.begin());
		if (!this.#running) this.#launch();
	}

	#resume = (): void => {
		if (!this.#running && !this.#disposed && !untrack(() => this.#done.current)) this.#launch();
	};
	#pause = (): void => {
		void this.#stop();
	};
	#show = (event: PageTransitionEvent): void => {
		if (event.persisted) this.#resume();
	};

	#launch(handshake?: PromiseWithResolvers<void>): void {
		if (this.#disposed) {
			handshake?.reject(new Error('Live query disposed'));
			return;
		}
		const controller = (this.#controller = new AbortController());
		let connected = false;
		const running = this.#loop(controller, () => {
			connected = true;
			handshake?.resolve();
		}).finally(() => {
			if (this.#running === running) this.#running = undefined;
			if (!connected) handshake?.reject(new Error('Live query connection was interrupted'));
		});
		this.#running = running;
		void running.catch(() => {});
	}

	async #loop(controller: AbortController, connect: () => void): Promise<void> {
		while (!controller.signal.aborted && !untrack(() => this.#done.current)) {
			try {
				for await (const value of this.#remotes.channel.stream(
					this.#id,
					this.#payload,
					controller.signal,
					() => {
						this.#connected.current = true;
						this.#attempt = 0;
						connect();
					}
				)) {
					if (controller.signal.aborted) return;
					this.set(value);
				}
				if (controller.signal.aborted) return;
				if (!this.available.current)
					throw new Error('Live query completed before yielding a value');
				this.#done.current = true;
				this.#end();
				return;
			} catch (error) {
				if (controller.signal.aborted) return;
				if (error instanceof Redirect) continue;
				if (!this.available.current || error instanceof HttpError) {
					const normalized = await this.#remotes.error(error);
					if (!controller.signal.aborted) this.fail(normalized);
					return;
				}
				if (!navigator.onLine) return;
				const base = Math.min(250 * 2 ** this.#attempt++, 10_000);
				await new Promise<void>((resolve) => {
					this.#wake = resolve;
					this.#delay = setTimeout(
						resolve,
						Math.max(0, Math.round(base * (0.8 + Math.random() * 0.4)))
					);
				});
				this.#wake = undefined;
			} finally {
				this.#connected.current = false;
			}
		}
	}

	async #stop(): Promise<void> {
		this.#controller?.abort();
		clearTimeout(this.#delay);
		this.#wake?.();
		await this.#running;
	}

	reconnect(): Promise<void> {
		return (this.#reconnecting ??= this.#reconnect().finally(() => {
			this.#reconnecting = undefined;
		}));
	}

	async #reconnect(): Promise<void> {
		await this.#stop();
		if (this.#disposed) throw new Error('Live query disposed');
		this.#done.current = false;
		this.#terminal = undefined;
		this.#attempt = 0;
		const handshake = Promise.withResolvers<void>();
		void handshake.promise.catch(() => {});
		this.#launch(handshake);
		return handshake.promise;
	}

	override set(value: T, request?: PromiseWithResolvers<void>): void {
		if (this.#remotes.owner.disposed) {
			this.destroy();
			return;
		}
		this.#remotes.owner.run(() => super.set(value, request));
		for (const subscriber of this.#subscribers) {
			if (subscriber.waiting) {
				subscriber.waiting.resolve({ value, done: false });
				subscriber.waiting = undefined;
			} else subscriber.pending = { value };
		}
		if (this.#transient && this.#subscribers.size === 0) this.destroy();
	}

	override fail(error: HttpError): void {
		const fail = () => {
			super.fail(error);
			this.#done.current = true;
		};
		if (this.#remotes.owner.disposed) fail();
		else this.#remotes.owner.run(fail);
		this.#controller?.abort();
		clearTimeout(this.#delay);
		this.#wake?.();
		this.#terminal = { error };
		this.#end(error);
	}

	#end(error?: unknown): void {
		for (const subscriber of this.#subscribers) {
			subscriber.done = true;
			if (error !== undefined) {
				subscriber.error = { error };
				if (subscriber.waiting) {
					subscriber.waiting.reject(error);
					subscriber.error = undefined;
				}
			} else subscriber.waiting?.resolve({ value: undefined, done: true });
			subscriber.waiting = undefined;
		}
		this.#subscribers.clear();
	}

	[Symbol.asyncIterator](): AsyncIterableIterator<T> {
		const subscriber: Subscriber<T> = {
			done: this.#disposed || untrack(() => this.#done.current),
			pending:
				this.available.current && !this.failure.current
					? { value: this.value.current as T }
					: undefined,
			error: this.#terminal
		};
		if (!subscriber.done) this.#subscribers.add(subscriber);
		this.start();
		const close = (): void => {
			subscriber.done = true;
			subscriber.pending = undefined;
			this.#subscribers.delete(subscriber);
			subscriber.waiting?.resolve({ value: undefined, done: true });
			subscriber.waiting = undefined;
			if (this.#transient && this.#subscribers.size === 0) this.destroy();
		};
		return {
			[Symbol.asyncIterator]() {
				return this;
			},
			next: () => {
				if (subscriber.error) {
					const error = subscriber.error.error;
					subscriber.error = undefined;
					close();
					return Promise.reject(error);
				}
				if (subscriber.pending) {
					const value = subscriber.pending.value;
					subscriber.pending = undefined;
					return Promise.resolve({ value, done: false });
				}
				if (subscriber.done) return Promise.resolve({ value: undefined, done: true });
				return (subscriber.waiting ??= Promise.withResolvers<IteratorResult<T>>()).promise;
			},
			return: () => {
				close();
				return Promise.resolve({ value: undefined, done: true });
			}
		};
	}

	get connected(): boolean {
		this.start();
		return this.#connected.current;
	}
	get done(): boolean {
		this.start();
		return this.#done.current;
	}

	destroy(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		window.removeEventListener('online', this.#resume);
		window.removeEventListener('offline', this.#pause);
		window.removeEventListener('pagehide', this.#pause);
		window.removeEventListener('beforeunload', this.#pause);
		window.removeEventListener('pageshow', this.#show);
		this.#controller?.abort();
		clearTimeout(this.#delay);
		this.#wake?.();
		if (!this.available.current)
			super.fail(new HttpError({ status: 500, message: 'Live query disposed' }));
		this.#end();
	}
}

class LiveRef<T> implements Promise<T>, AsyncIterable<T> {
	readonly #remotes: Remotes;
	readonly #id: string;
	readonly #payload: string;
	readonly [resourceKey]: string;
	#oneShot?: LiveQuery<T>;

	constructor(remotes: Remotes, id: string, argument: unknown) {
		this.#remotes = remotes;
		this.#id = id;
		this.#payload = encodeArgument(argument, remotes.client.app.hooks.transport);
		this[resourceKey] = getRemoteKey(id, this.#payload);
		if (getOwner()) this.#read();
	}
	#read(): LiveQuery<T> {
		if (!getOwner() && this.#oneShot) return this.#oneShot;
		const resource = this.#remotes.resource('query_live', this.#id, this.#payload) as LiveQuery<T>;
		if (!getOwner()) this.#oneShot = resource;
		return resource;
	}
	get then(): Promise<T>['then'] {
		return this.#read().then;
	}
	get catch(): Promise<T>['catch'] {
		const value = this.#read();
		value.start();
		return value.catch.bind(value);
	}
	get finally(): Promise<T>['finally'] {
		const value = this.#read();
		value.start();
		return value.finally.bind(value);
	}
	get current(): T | undefined {
		return this.#read().current;
	}
	get ready(): boolean {
		return this.#read().ready;
	}
	get loading(): boolean {
		return this.#read().loading;
	}
	get error(): App.Error | undefined {
		return this.#read().error;
	}
	get connected(): boolean {
		return this.#read().connected;
	}
	get done(): boolean {
		return this.#read().done;
	}
	reconnect(): Promise<void> {
		return this.#read().reconnect();
	}
	[Symbol.asyncIterator](): AsyncIterableIterator<T> {
		return this.#read()[Symbol.asyncIterator]();
	}
	get [Symbol.toStringTag](): string {
		return 'LiveQuery';
	}
}

export function query_live<Input = any, Output = any>(
	id: string
): RemoteLiveQueryFunction<Input, Output> {
	if (DEV) currentClient()?.remote.reload(id);
	const fn = (argument: unknown) =>
		new LiveRef<Output>(client('query.live').remote, id, argument) as RemoteLiveQuery<Output>;
	Object.defineProperty(fn, queryId, { value: id });
	return fn;
}
