import { getOwner, hydrated, onDestroy, openHydration, root, type Owner } from 'vigla';
import { createSubscriber } from 'vigla/reactivity';
import { tracking } from 'vigla/internal/client';
import { DEV } from 'esm-env';
import type { RemoteData, RemoteNode } from '../../types/internal/remote.ts';
import { getRemoteKey } from '../../shared/remote.ts';
import { HttpError } from '../../shared/outcomes.ts';
import type { Client } from '../client.ts';
import { payload } from '../payload.ts';
import { Channel } from './channel.ts';
import { Query, type QueryFlight, type QueryKind } from './query.ts';
import { LiveQuery } from './live.ts';
import { Forms } from './form.ts';
import { Command } from './command.ts';

export type QueryType = QueryKind | 'query_live';
type Resource = Query<any> | LiveQuery<any>;

interface Entry {
	id: string;
	kind: QueryType;
	resource: Resource;
	holders: Set<Owner>;
	readers: number;
	subscribe: () => void;
}
interface BatchCall {
	result: PromiseWithResolvers<any>;
	flight: QueryFlight;
}
interface Batch {
	payloads: Map<string, BatchCall[]>;
}

export class Remotes {
	readonly client: Client;
	readonly channel: Channel;
	readonly #input: Owner;
	readonly #entries = new Map<string, Entry>();
	readonly #flights = new Map<string, QueryFlight>();
	readonly #seeds = new Map<string, RemoteNode>();
	readonly #claimed = new Set<string>();
	readonly #batches = new Map<string, Batch>();
	readonly #forms = new Map<string, Forms>();
	readonly #commands = new Map<string, Command>();
	#persistent?: Promise<Cache | undefined>;

	constructor(client: Client, target: HTMLElement) {
		this.client = client;
		this.channel = new Channel(client);
		this.#input = client.owner.run(() => root());
		this.#input.run(() => onDestroy(openHydration({ format: client.app.format, target })));
		client.owner.run(() => onDestroy(() => this.dispose()));
	}

	get owner(): Owner {
		return this.client.owner;
	}

	seed(key: string): RemoteNode | Promise<RemoteNode> | undefined {
		const encoded = this.#claimed.has(key)
			? undefined
			: this.#input.run(() => hydrated<string | Promise<string> | undefined>(key, () => undefined));
		if (encoded !== undefined) this.#claimed.add(key);
		const seeded = this.#seeds.get(key);
		if (seeded) {
			this.#seeds.delete(key);
			return seeded;
		}
		if (encoded === undefined) return;
		return typeof encoded === 'string'
			? (this.client.transport.parse(encoded) as RemoteNode)
			: encoded.then((value) => this.client.transport.parse(value) as RemoteNode);
	}

	forget(key: string): void {
		this.#seeds.delete(key);
	}

	resource(kind: QueryType, id: string, argument: string): Resource {
		const key = getRemoteKey(id, argument);
		const holder = getOwner();
		let entry = this.#entries.get(key);
		if (!entry) {
			const pending = this.#pending(key);
			const seed = pending ? undefined : this.seed(key);
			if (kind === 'prerender' && seed)
				void Promise.resolve(seed)
					.then((node) => {
						if (!node.e) return this.persist(id, argument, node.v);
					})
					.catch(() => {});
			const resource =
				pending ??
				this.owner.run(() =>
					kind === 'query_live'
						? new LiveQuery(this, id, argument, seed, holder === null)
						: new Query(this, key, (flight) => this.load(kind, id, argument, flight), seed)
				);
			if (holder === null) return resource;
			const held: Entry = {
				id,
				kind,
				resource,
				holders: new Set(),
				readers: 0,
				subscribe: createSubscriber(() => {
					held.readers++;
					return () => this.#release(key, held);
				})
			};
			entry = held;
			this.#entries.set(key, entry);
		}
		if (tracking()) entry.subscribe();
		else if (holder && !entry.holders.has(holder)) {
			entry.holders.add(holder);
			entry.readers++;
			const held = entry;
			holder.run(() =>
				onDestroy(() => {
					held.holders.delete(holder);
					queueMicrotask(() => this.#release(key, held));
				})
			);
		}
		return entry.resource;
	}

	track(flight: QueryFlight): void {
		this.#flights.set(flight.key, flight);
		const release = () => {
			if (this.#flights.get(flight.key) === flight) this.#flights.delete(flight.key);
		};
		void flight.request.promise.then(release, release);
	}

	#pending(key: string): Query<any> | undefined {
		const flight = this.#flights.get(key);
		return flight?.resource.pending(flight.request) ? flight.resource : undefined;
	}

	#release(key: string, entry: Entry): void {
		entry.readers--;
		if (entry.readers === 0 && this.#entries.get(key) === entry) {
			this.#entries.delete(key);
			this.#seeds.delete(key);
			if (entry.resource instanceof LiveQuery) entry.resource.destroy();
		}
	}

	*keys(id: string): Iterable<string> {
		for (const [key, entry] of this.#entries) {
			if (entry.id === id && entry.kind !== 'prerender') yield key;
		}
	}

	forms(id: string): Forms {
		let forms = this.#forms.get(id);
		if (!forms) {
			forms = this.owner.run(() => new Forms(this, id));
			this.#forms.set(id, forms);
		}
		return forms;
	}

	command(id: string): Command {
		let command = this.#commands.get(id);
		if (!command) {
			command = this.owner.run(() => new Command(this, id));
			this.#commands.set(id, command);
		}
		return command;
	}

	apply(data: RemoteData, refreshes?: Set<string>, flights: readonly QueryFlight[] = []): void {
		for (const [kind, nodes] of [
			['query', data.q],
			['query_live', data.l]
		] as const) {
			for (const [key, node] of Object.entries(nodes ?? {})) {
				refreshes?.delete(key);
				const origins = kind === 'query' ? flights.filter((flight) => flight.key === key) : [];
				if (origins.length) {
					for (const origin of origins) {
						if (node.e) origin.resource.fail(new HttpError(node.e), origin.request);
						else origin.resource.set(node.v, origin.request);
					}
					continue;
				}
				const resource = this.#entries.get(key)?.resource ?? this.#pending(key);
				if (resource) {
					if (node.e) resource.fail(new HttpError(node.e));
					else {
						resource.set(node.v);
						if (kind === 'query_live' && resource instanceof LiveQuery)
							void resource.reconnect().catch(() => {});
					}
				} else if (!node.e) this.#seeds.set(key, node);
			}
		}
		for (const nodes of [data.p, data.f]) {
			for (const [key, node] of Object.entries(nodes ?? {}))
				if (!node.e) this.#seeds.set(key, node);
		}
		for (const key of data.i ?? []) refreshes?.delete(key);
	}

	failMissing(refreshes?: Set<string>): void {
		for (const key of refreshes ?? []) {
			this.#entries.get(key)?.resource.fail(
				new HttpError({
					status: 400,
					message: 'Requested update was not handled by the remote function'
				})
			);
		}
	}

	async error(error: unknown): Promise<HttpError> {
		if (error instanceof HttpError) return error;
		if (this.owner.disposed)
			return new HttpError({ status: 500, message: 'Remote client disposed' });
		return new HttpError(
			await this.client.pages.error(error, {
				url: new URL(location.href),
				params: {},
				route: { id: null }
			})
		);
	}

	reload(id: string): void {
		for (const entry of this.#entries.values())
			if (entry.id === id) {
				void (
					entry.resource instanceof LiveQuery
						? entry.resource.reconnect()
						: entry.resource.refresh()
				).catch(() => {});
			}
	}

	prepare(): () => Promise<void> {
		const previous = new Map(this.#entries);
		for (const entry of previous.values())
			if (entry.resource instanceof Query && entry.kind !== 'prerender') entry.resource.reset();
		return async () => {
			const work: Promise<unknown>[] = [];
			for (const [key, entry] of previous) {
				if (this.#entries.get(key) !== entry) continue;
				if (entry.resource instanceof LiveQuery) work.push(entry.resource.reconnect());
				else if (entry.kind !== 'prerender') work.push(Promise.resolve(entry.resource));
			}
			await Promise.allSettled(work);
		};
	}

	async refresh(): Promise<void> {
		const work: Promise<unknown>[] = [];
		for (const entry of this.#entries.values()) {
			if (entry.resource instanceof LiveQuery) work.push(entry.resource.reconnect());
			else if (entry.kind !== 'prerender') work.push(entry.resource.refresh());
		}
		await Promise.allSettled(work);
	}

	async load(kind: QueryKind, id: string, argument: string, flight: QueryFlight): Promise<any> {
		if (kind === 'query_batch') return this.batch(id, argument, flight);
		if (kind === 'prerender') return this.prerender(id, argument);
		const data = await this.channel.request(
			this.channel.url(id) + (argument ? `?payload=${argument}` : ''),
			undefined,
			undefined,
			[flight]
		);
		if (data.redirect) await this.channel.redirect(data.redirect);
		return data._;
	}

	batch(id: string, argument: string, flight: QueryFlight): Promise<any> {
		let batch = this.#batches.get(id);
		const request = Promise.withResolvers<any>();
		if (!batch) {
			batch = { payloads: new Map() };
			this.#batches.set(id, batch);
			queueMicrotask(() => void this.#flush(id, batch!));
		}
		const waiting = batch.payloads.get(argument) ?? [];
		waiting.push({ result: request, flight });
		batch.payloads.set(argument, waiting);
		return request.promise;
	}

	async #flush(id: string, batch: Batch): Promise<void> {
		this.#batches.delete(id);
		try {
			const data = await this.channel.request(
				this.channel.url(id),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ payloads: [...batch.payloads.keys()] })
				},
				undefined,
				[...batch.payloads.values()].flat().map((call) => call.flight)
			);
			if (data.redirect) {
				await this.channel.redirect(data.redirect);
				for (const waiting of batch.payloads.values())
					for (const call of waiting) call.result.resolve(undefined);
				return;
			}
			const results: unknown = data._;
			if (!Array.isArray(results) || results.length !== batch.payloads.size)
				throw new TypeError('Invalid query.batch response');
			let index = 0;
			for (const waiting of batch.payloads.values()) {
				const result = results[index++];
				if (
					result === null ||
					typeof result !== 'object' ||
					(result.type !== 'error' && result.type !== 'result')
				)
					throw new TypeError('Invalid query.batch result');
				for (const call of waiting) {
					if (result.type === 'error') call.result.reject(new HttpError(result.error));
					else call.result.resolve(result.data);
				}
			}
		} catch (error) {
			for (const waiting of batch.payloads.values())
				for (const call of waiting) call.result.reject(error);
		}
	}

	#cache(): Promise<Cache | undefined> {
		return (this.#persistent ??= (async () => {
			if (typeof caches === 'undefined') return;
			try {
				const name = `sveltekit:${DEV ? Date.now() : payload.version}`;
				const cache = await caches.open(name);
				for (const key of await caches.keys())
					if (key.startsWith('sveltekit:') && key !== name) await caches.delete(key);
				return cache;
			} catch {
				return;
			}
		})());
	}

	async persist(id: string, argument: string, value: unknown): Promise<void> {
		const cache = await this.#cache();
		if (!cache || this.owner.disposed) return;
		const url = this.channel.url(id) + (argument ? `/${argument}` : '');
		await cache
			.put(
				url,
				new Response(this.client.transport.stringify(value), {
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.catch(() => {});
	}

	async prerender(id: string, argument: string): Promise<any> {
		const url = this.channel.url(id) + (argument ? `/${argument}` : '');
		const cache = await this.#cache();
		if (cache) {
			try {
				const response = await cache.match(url);
				if (response) return this.client.transport.parse(await response.text());
			} catch {
				await cache.delete(url).catch(() => {});
			}
		}
		const data = await this.channel.request(url, { headers: this.channel.headers() });
		if (data.redirect) {
			await this.channel.redirect(data.redirect);
			return;
		}
		if (cache) void this.persist(id, argument, data._).catch(() => {});
		return data._;
	}

	dispose(): void {
		this.#input.dispose();
		this.channel.abort();
		for (const entry of this.#entries.values())
			if (entry.resource instanceof LiveQuery) entry.resource.destroy();
		this.#entries.clear();
		this.#flights.clear();
		this.#seeds.clear();
		this.#claimed.clear();
		this.#forms.clear();
		this.#commands.clear();
	}
}
