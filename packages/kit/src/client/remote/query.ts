import { cell, getOwner, untrack } from 'vigla';
import type {
	RemoteQuery,
	RemoteQueryFunction,
	RemotePrerenderFunction,
	RemoteResource
} from '../../types/remote.ts';
import type { RemoteNode } from '../../types/internal/remote.ts';
import { encodeArgument, getRemoteKey } from '../../shared/remote.ts';
import { HttpError } from '../../shared/outcomes.ts';
import { client, currentClient } from '../client.ts';
import { DEV } from 'esm-env';
import type { Remotes } from './cache.ts';
import { Result } from './result.ts';
import { overrideKey, queryId, resourceKey } from './updates.ts';

export type QueryKind = 'query' | 'query_batch' | 'prerender';

interface Override<T> {
	update: (value: T) => T;
}

export class Query<T> extends Result<T> {
	readonly #remotes: Remotes;
	readonly #key: string;
	readonly #load: () => Promise<T>;
	readonly #overrides = cell<Override<T>[]>([]);

	constructor(
		remotes: Remotes,
		key: string,
		load: () => Promise<T>,
		seed?: RemoteNode | Promise<RemoteNode>
	) {
		super();
		this.#remotes = remotes;
		this.#key = key;
		this.#load = load;
		if (seed instanceof Promise) {
			const request = this.begin();
			void seed.then(
				(node) => {
					if (node.e) this.fail(new HttpError(node.e), request);
					else this.set(node.v, request);
				},
				async (error) => this.fail(await remotes.error(error), request)
			);
		} else if (seed) {
			if (seed.e) this.fail(new HttpError(seed.e));
			else this.set(seed.v);
		}
	}

	override start(): void {
		if (untrack(() => this.promise.current) === undefined) void this.refresh().catch(() => {});
	}

	override track(): void {
		this.#overrides.current;
	}

	override read(): T | undefined {
		if (!this.available.current) return undefined;
		return this.#overrides.current.reduce(
			(value, override) => override.update(value),
			this.value.current as T
		);
	}

	override set(value: T, request?: PromiseWithResolvers<void>): void {
		this.#remotes.forget(this.#key);
		if (this.#remotes.owner.disposed) {
			super.fail(new HttpError({ status: 500, message: 'Remote client disposed' }), request);
			return;
		}
		this.#remotes.owner.run(() => super.set(value, request));
	}

	override fail(error: HttpError, request?: PromiseWithResolvers<void>): void {
		this.#remotes.forget(this.#key);
		if (this.#remotes.owner.disposed) super.fail(error, request);
		else this.#remotes.owner.run(() => super.fail(error, request));
	}

	refresh(): Promise<void> {
		this.#remotes.forget(this.#key);
		const request = this.#remotes.owner.run(() => this.begin());
		void Promise.resolve()
			.then(this.#load)
			.then(
				(value) => this.set(value, request),
				async (error) => {
					if (this.pending(request)) this.fail(await this.#remotes.error(error), request);
				}
			);
		return request.promise;
	}

	reset(): void {
		this.#remotes.forget(this.#key);
		this.#remotes.owner.run(() => {
			this.promise.current = undefined;
		});
	}

	withOverride(update: (value: T) => T): () => void {
		const override: Override<T> = { update };
		untrack(() => {
			this.#overrides.current = [...this.#overrides.current, override];
		});
		const release = () =>
			untrack(() => {
				if (this.#overrides.current.includes(override))
					this.#overrides.current = this.#overrides.current.filter(
						(candidate) => candidate !== override
					);
			});
		Object.defineProperty(release, overrideKey, { value: this.#key });
		return release;
	}
}

class ReadRef<T> implements Promise<T> {
	readonly #remotes: Remotes;
	readonly #kind: QueryKind;
	readonly #id: string;
	readonly #payload: string;
	protected readonly key: string;
	#oneShot?: Query<T>;

	constructor(remotes: Remotes, kind: QueryKind, id: string, argument: unknown) {
		this.#remotes = remotes;
		this.#kind = kind;
		this.#id = id;
		this.#payload = encodeArgument(argument, remotes.client.app.hooks.transport);
		this.key = getRemoteKey(id, this.#payload);
		if (getOwner()) this.read();
	}

	protected read(): Query<T> {
		if (!getOwner() && this.#oneShot) return this.#oneShot;
		const resource = this.#remotes.resource(this.#kind, this.#id, this.#payload) as Query<T>;
		if (!getOwner()) this.#oneShot = resource;
		return resource;
	}

	get then(): Promise<T>['then'] {
		return this.read().then;
	}
	get catch(): Promise<T>['catch'] {
		const resource = this.read();
		resource.start();
		return resource.catch.bind(resource);
	}
	get finally(): Promise<T>['finally'] {
		const resource = this.read();
		resource.start();
		return resource.finally.bind(resource);
	}
	get current(): T | undefined {
		return this.read().current;
	}
	get ready(): boolean {
		return this.read().ready;
	}
	get loading(): boolean {
		return this.read().loading;
	}
	get error(): App.Error | undefined {
		return this.read().error;
	}
	get [Symbol.toStringTag](): string {
		return this.#kind === 'prerender' ? 'Prerender' : 'Query';
	}
}

class QueryRef<T> extends ReadRef<T> {
	readonly [resourceKey]: string;

	constructor(remotes: Remotes, kind: QueryKind, id: string, argument: unknown) {
		super(remotes, kind, id, argument);
		this[resourceKey] = this.key;
	}
	refresh(): Promise<void> {
		return this.read().refresh();
	}
	set(value: T): void {
		this.read().set(value);
	}
	withOverride(update: (value: T) => T): () => void {
		return this.read().withOverride(update);
	}
}

function factory<Input, Output>(kind: QueryKind, id: string): RemoteQueryFunction<Input, Output> {
	if (DEV) currentClient()?.remote.reload(id);
	const fn = (argument: unknown) =>
		new QueryRef<Output>(client(kind).remote, kind, id, argument) as RemoteQuery<Output>;
	Object.defineProperty(fn, queryId, { value: id });
	return fn;
}

export function query<Input = any, Output = any>(id: string): RemoteQueryFunction<Input, Output> {
	return factory('query', id);
}
export function query_batch<Input = any, Output = any>(
	id: string
): RemoteQueryFunction<Input, Output> {
	return factory('query_batch', id);
}
export function prerender<Input = any, Output = any>(
	id: string
): RemotePrerenderFunction<Input, Output> {
	return (argument) =>
		new ReadRef<Output>(
			client('prerender').remote,
			'prerender',
			id,
			argument
		) as RemoteResource<Output>;
}
