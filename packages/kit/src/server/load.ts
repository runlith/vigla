import type { PageNode, RequestStore, ServerDataNode, Uses } from '../types/internal/server.ts';
import type { ServerLoadEvent } from '../types/request.ts';
import type { ParamValue } from '../types/params.ts';
import type { Server } from './index.ts';
import { makeTrackable } from '../shared/url.ts';
import { load_invalid_response } from '../shared/errors.ts';
import type { ActionResult } from './actions.ts';
import { runRequest } from './scope.ts';
import { replayFetch } from './replay.ts';
import { restrictSearch } from './url.ts';
import * as warnings from './warnings.ts';

export interface LoadedNode {
	depth: number;
	node: PageNode;
	server: ServerDataNode | null;
	data: Record<string, any> | null;
}

export function validateLoad(
	value: unknown,
	location: string
): asserts value is Record<string, any> | null | undefined {
	if (value == null || Object.getPrototypeOf(value) === Object.prototype) return;
	load_invalid_response({
		location,
		type:
			typeof value !== 'object'
				? `a ${typeof value}`
				: value instanceof Response
					? 'a Response object'
					: Array.isArray(value)
						? 'an array'
						: 'a non-plain object'
	});
}

export async function serverLoad(
	server: Server,
	store: RequestStore,
	node: PageNode | undefined,
	parent: () => Promise<Record<string, any>>
): Promise<ServerDataNode | null> {
	if (!node?.server) return null;
	const uses: Uses = {
		dependencies: new Set(),
		params: new Set(),
		parent: false,
		route: false,
		url: false,
		search_params: new Set()
	};
	if (!node.server.load)
		return { type: 'data', data: null, uses, slash: node.server.trailingSlash };
	const { event } = store;
	let tracking = true;
	let done = false;
	const track = (usage: string, change: string, fn: () => void): void => {
		if (!tracking) return;
		if (done) {
			if (server.options.dev)
				warnings.load_tracking_after_return({
					id: node.server_id ?? event.route.id ?? '',
					usage,
					change
				});
			return;
		}
		fn();
	};
	const url = makeTrackable(
		event.url,
		() =>
			track('Accessing URL properties', 'the URL changes', () => {
				uses.url = true;
			}),
		(name) =>
			track('Accessing URL properties', 'the URL changes', () => uses.search_params.add(name))
	);
	restrictSearch(url, store.state, true);
	const input: ServerLoadEvent<Record<string, ParamValue>> = {
		...event,
		params: new Proxy(event.params, {
			get(target, key, receiver) {
				if (typeof key === 'string')
					track(`Accessing \`params.${key}\``, 'the param changes', () => uses.params.add(key));
				return Reflect.get(target, key, receiver);
			}
		}),
		route: new Proxy(event.route, {
			get(target, key, receiver) {
				track('Accessing route properties', 'the route changes', () => {
					uses.route = true;
				});
				return Reflect.get(target, key, receiver);
			}
		}),
		url,
		parent: () => {
			track('Calling `parent(...)`', 'parent data changes', () => {
				uses.parent = true;
			});
			return parent();
		},
		depends: (...dependencies) => {
			for (const dependency of dependencies)
				track('Calling `depends(...)`', 'the dependency is invalidated', () =>
					uses.dependencies.add(new URL(dependency, event.url).href)
				);
		},
		untrack: (fn) => {
			const previous = tracking;
			tracking = false;
			try {
				return fn();
			} finally {
				tracking = previous;
			}
		}
	};
	const result: unknown = await server.tracer.span(
		'sveltekit.load',
		{
			'sveltekit.load.node_id': node.server_id ?? 'unknown',
			'sveltekit.load.environment': 'server',
			'http.route': event.route.id ?? 'unknown'
		},
		async (span) => {
			const traced = { ...input, tracing: { ...input.tracing, current: span } };
			return runRequest(
				{ ...store, event: traced },
				() => node.server!.load!(traced),
				server.scope
			);
		}
	);
	validateLoad(
		result,
		node.server_id ? `in ${node.server_id}` : `related to route '${event.route.id}'`
	);
	observePromises(result);
	done = true;
	return { type: 'data', data: result ?? null, uses, slash: node.server.trailingSlash };
}

export async function universalLoad(
	server: Server,
	store: RequestStore,
	node: PageNode,
	data: Promise<ServerDataNode | null>,
	parent: () => Promise<Record<string, any>>,
	csr: boolean
): Promise<Record<string, any> | null> {
	const serverData = await data;
	if (!node.universal?.load) return serverData?.data ?? null;
	const { event } = store;
	const result: unknown = await server.tracer.span(
		'sveltekit.load',
		{
			'sveltekit.load.node_id': node.universal_id ?? 'unknown',
			'sveltekit.load.environment': 'universal',
			'http.route': event.route.id ?? 'unknown'
		},
		async (span) =>
			runRequest(
				store,
				() =>
					node.universal!.load!({
						url: event.url,
						params: event.params,
						data: serverData?.data ?? null,
						route: event.route,
						fetch: replayFetch(server, store, csr),
						setHeaders: event.setHeaders,
						depends() {},
						parent,
						untrack: (fn) => fn(),
						tracing: { ...event.tracing, current: span }
					}),
				server.scope
			)
	);
	validateLoad(
		result,
		node.universal_id ? `in ${node.universal_id}` : `related to route '${event.route.id}'`
	);
	return result ?? null;
}

function observePromises(value: unknown, seen = new WeakSet<object>()): void {
	if (!value || typeof value !== 'object' || seen.has(value)) return;
	seen.add(value);
	if ('then' in value && typeof value.then === 'function') {
		void Promise.resolve(value)
			.then(
				(resolved) => observePromises(resolved, seen),
				() => {}
			)
			.catch(() => {});
	} else if (value instanceof Map) {
		for (const [key, entry] of value) {
			observePromises(key, seen);
			observePromises(entry, seen);
		}
	} else if (value instanceof Set) {
		for (const entry of value) observePromises(entry, seen);
	} else {
		for (const entry of Object.values(value)) observePromises(entry, seen);
	}
}

export function loadBranch(
	server: Server,
	store: RequestStore,
	nodes: Array<PageNode | undefined>,
	csr: boolean,
	action?: ActionResult
): Array<Promise<LoadedNode | null>> {
	const serverData: Array<Promise<ServerDataNode | null>> = [];
	const universalData: Array<Promise<Record<string, any> | null>> = [];
	for (const [index, node] of nodes.entries()) {
		const parent = async (
			promises: Array<Promise<Record<string, any> | null>>
		): Promise<Record<string, any>> =>
			Object.assign({}, ...(await Promise.all(promises.slice(0, index))));
		serverData[index] =
			index === nodes.length - 1 && action?.type === 'error'
				? Promise.reject(action.error)
				: serverLoad(server, store, node, () =>
						parent(serverData.map((promise) => promise.then((value) => value?.data ?? null)))
					);
		serverData[index]!.catch(() => {});
		universalData[index] = node
			? universalLoad(server, store, node, serverData[index]!, () => parent(universalData), csr)
			: Promise.resolve(null);
		universalData[index]!.catch(() => {});
	}
	return nodes.map((node, index) =>
		node
			? Promise.all([serverData[index]!, universalData[index]!]).then(([server, data]) => ({
					depth: index,
					node,
					server,
					data
				}))
			: Promise.resolve(null)
	);
}
