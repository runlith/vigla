import { stringify, uneval } from 'devalue';
import { getAbortSignal } from 'vigla';
import type { DataErrorNode, DataSkippedNode, SerializedUses } from '../types/internal/data.ts';
import type { RequestStore, ServerDataNode, ServerRoute, Uses } from '../types/internal/server.ts';
import type { Server } from './index.ts';
import { encoders } from '../shared/serialization.ts';
import { Redirect } from '../shared/outcomes.ts';
import { serverLoad } from './load.ts';
import { handleError } from './failure.ts';
import { Chunks, streamText } from './stream.ts';
import * as errors from './errors.ts';

export function serializedUses(uses: Uses): SerializedUses {
	const value: SerializedUses = {};
	if (uses.dependencies.size) value.dependencies = [...uses.dependencies];
	if (uses.params.size) value.params = [...uses.params];
	if (uses.search_params.size) value.search_params = [...uses.search_params];
	if (uses.parent) value.parent = 1;
	if (uses.route) value.route = 1;
	if (uses.url) value.url = 1;
	return value;
}

export interface SerializedData {
	data: string;
	chunks: AsyncIterable<string> | null;
}

type DataResult = ServerDataNode | DataErrorNode | DataSkippedNode | null;

export class DataSerializer {
	readonly #server: Server;
	readonly #store: RequestStore;
	readonly #html: boolean;
	readonly #namespace: string;
	readonly #chunks: Chunks<string>;
	#id = 1;

	constructor(server: Server, store: RequestStore, html: boolean, namespace = '') {
		this.#server = server;
		this.#store = store;
		this.#html = html;
		this.#namespace = namespace;
		this.#chunks = new Chunks(store.owner.run(() => getAbortSignal()));
	}

	#promise(value: any): number | undefined {
		if (!value || typeof value.then !== 'function') return undefined;
		const id = this.#id++;
		this.#chunks.add(
			Promise.resolve(value)
				.then(
					(data) => ({ data, error: undefined }),
					async (error) => ({
						data: undefined,
						error: await handleError(this.#store, error)
					})
				)
				.then(async (result) => {
					let data: string;
					try {
						data = this.#value(
							this.#html
								? result.error
									? [, result.error]
									: [result.data]
								: (result.error ?? result.data)
						);
					} catch (cause) {
						let failure: unknown;
						try {
							errors.load_promise_not_serializable(
								{ id: this.#store.event.route.id ?? '' },
								{ cause }
							);
						} catch (error) {
							failure = error;
						}
						result.error = await handleError(this.#store, failure);
						data = this.#value(this.#html ? [, result.error] : result.error);
					}
					return this.#html
						? `${this.#namespace}.ready.then(()=>${this.#namespace}.resolve(${id}, (app) => ${data}));`
						: `{"type":"chunk","id":${id},"${result.error ? 'error' : 'data'}":${data}}\n`;
				})
		);
		return id;
	}

	#value(value: unknown): string {
		const transport = this.#server.hooks.transport ?? {};
		if (!this.#html)
			return stringify(value, { ...encoders(transport), Promise: (value) => this.#promise(value) });
		const replace = (value: any): string | undefined => {
			const id = this.#promise(value);
			if (id !== undefined) return `${this.#namespace}.defer(${id})`;
			for (const [name, codec] of Object.entries(transport)) {
				const encoded = codec.encode(value);
				if (encoded) return `app.decode(${JSON.stringify(name)}, ${uneval(encoded, replace)})`;
			}
			return undefined;
		};
		return uneval(value, replace);
	}

	serialize(nodes: DataResult[]): SerializedData {
		const strings = nodes.map((node) => {
			if (!node) return 'null';
			if (node.type !== 'data') return JSON.stringify(node);
			try {
				const uses = serializedUses(node.uses);
				const data = this.#value(node.data);
				return `{"type":"data","data":${data},"uses":${JSON.stringify(uses)}${node.slash ? `,"slash":${JSON.stringify(node.slash)}` : ''}}`;
			} catch (error) {
				if (error instanceof Error && 'path' in error)
					errors.load_not_serializable(
						{
							id: this.#store.event.route.id ?? '',
							message: error.message,
							path: `data${error.path}`
						},
						{ cause: error }
					);
				throw error;
			}
		});
		return {
			data: this.#html
				? `[${strings.join(',')}]`
				: `{"type":"data","nodes":[${strings.join(',')}]}\n`,
			chunks: this.#id > 1 ? this.#chunks : null
		};
	}
}

export async function dataResponse(
	server: Server,
	store: RequestStore,
	route: ServerRoute,
	invalidated?: boolean[]
): Promise<Response> {
	if (!route.page)
		return new Response(null, {
			status: 404,
			headers: { 'x-sveltekit-version': server.options.version.name }
		});
	const indexes = [...route.page.layouts, route.page.leaf];
	const loads: Array<() => Promise<ServerDataNode | null>> = [];
	let aborted = false;
	for (const [index, id] of indexes.entries()) {
		let pending: Promise<ServerDataNode | null> | undefined;
		loads.push(
			() =>
				(pending ??= (async () => {
					if (aborted) return null;
					const node = id == null ? undefined : await server.manifest.nodes[id]!();
					return serverLoad(server, store, node, async () =>
						Object.assign(
							{},
							...(await Promise.all(loads.slice(0, index).map((load) => load()))).map(
								(value) => value?.data
							)
						)
					);
				})().catch((error) => {
					aborted = true;
					throw error;
				}))
		);
	}
	try {
		const nodes = await Promise.all(
			loads.map(async (load, index): Promise<DataResult> => {
				if (invalidated && !invalidated[index]) return { type: 'skip' };
				try {
					return await load();
				} catch (error) {
					if (error instanceof Redirect) throw error;
					const body = await handleError(store, error);
					return { type: 'error', error: body, status: body.status };
				}
			})
		);
		const { data, chunks } = new DataSerializer(server, store, false).serialize(nodes);
		return new Response(chunks ? streamText(data, chunks) : data, {
			headers: {
				'content-type': chunks ? 'text/sveltekit-data' : 'application/json',
				'cache-control': 'private, no-store',
				'x-sveltekit-version': server.options.version.name
			}
		});
	} catch (error) {
		if (error instanceof Redirect)
			return Response.json(
				{ type: 'redirect', status: error.status, location: error.location },
				{
					headers: {
						'cache-control': 'private, no-store',
						'x-sveltekit-version': server.options.version.name
					}
				}
			);
		const body = await handleError(store, error);
		return Response.json(body, {
			status: body.status,
			headers: {
				'cache-control': 'private, no-store',
				'x-sveltekit-version': server.options.version.name
			}
		});
	}
}
