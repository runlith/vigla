import { stringify, uneval } from 'devalue';
import { getAbortSignal } from 'vigla';
import type {
	DataErrorNode,
	DataNode,
	DataSkippedNode,
	SerializedUses
} from '../types/internal/data.ts';
import type { RequestStore, ServerDataNode, Uses } from '../types/internal/server.ts';
import type { PageBranch } from '../types/internal/routes.ts';
import type { Server } from './index.ts';
import { encoders } from '../shared/serialization.ts';
import { escapeJson } from '../shared/escape.ts';
import { Redirect } from '../shared/outcomes.ts';
import { serverLoad } from './load.ts';
import { handleError } from './failure.ts';
import { Chunks, streamText } from './stream.ts';
import { versionHeader } from './headers.ts';
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
				if (encoded) return `app.decode(${escapeJson(name)}, ${uneval(encoded, replace)})`;
			}
			return undefined;
		};
		return uneval(value, replace);
	}

	serialize(nodes: DataResult[]): SerializedData {
		const strings = nodes.map((node) => {
			if (!node) return 'null';
			if (node.type !== 'data') return this.#html ? this.#value(node) : JSON.stringify(node);
			try {
				const payload: DataNode = {
					type: 'data',
					data: node.data,
					uses: serializedUses(node.uses)
				};
				if (node.slash) payload.slash = node.slash;
				if (this.#html) return this.#value(payload);
				const data = this.#value(node.data);
				return `{"type":"data","data":${data},"uses":${JSON.stringify(payload.uses)}${node.slash ? `,"slash":${JSON.stringify(node.slash)}` : ''}}`;
			} catch (error) {
				if (error instanceof Error && 'path' in error)
					errors.load_not_serializable(
						{
							id: this.#store.event.route.id ?? '',
							message: error.message,
							path: this.#html ? String(error.path).slice(1) : `data${error.path}`
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
	page: PageBranch | null,
	invalidated?: boolean[]
): Promise<Response> {
	if (!page)
		return new Response(null, {
			status: 404,
			headers: versionHeader(server.options)
		});
	const indexes = [...page.layouts, page.leaf];
	const loads: Array<() => Promise<ServerDataNode | null>> = [];
	const pending: Array<Promise<ServerDataNode | null> | undefined> = [];
	let aborted = false;
	for (const [index, id] of indexes.entries()) {
		loads.push(
			() =>
				(pending[index] ??= (async () => {
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
		await Promise.all(
			loads.map((load, index) =>
				invalidated && !invalidated[index]
					? null
					: load().catch((error) => {
							if (error instanceof Redirect) throw error;
							return null;
						})
			)
		);
		const nodes = await Promise.all(
			loads.map(async (_load, index): Promise<DataResult> => {
				if (!pending[index]) return { type: 'skip' };
				try {
					return await pending[index]!;
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
				...versionHeader(server.options)
			}
		});
	} catch (error) {
		if (error instanceof Redirect)
			return Response.json(
				{ type: 'redirect', status: error.status, location: error.location },
				{
					headers: {
						'cache-control': 'private, no-store',
						...versionHeader(server.options)
					}
				}
			);
		const body = await handleError(store, error);
		return Response.json(body, {
			status: body.status,
			headers: {
				'cache-control': 'private, no-store',
				...versionHeader(server.options)
			}
		});
	}
}
