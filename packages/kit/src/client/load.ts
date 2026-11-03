import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import type { Owner } from 'vigla';
import type {
	ClientApp,
	ClientNode,
	HydrationPayload,
	MatchedParams,
	NodeLoader
} from '../types/internal/client.ts';
import type {
	DataNode,
	DataResponse,
	DataRedirectNode,
	SerializedUses,
	TrailingSlash
} from '../types/internal/data.ts';
import type { NavigationEvent, LoadEvent } from '../types/request.ts';
import { HttpError, Redirect, FrameworkError, HandledError } from '../shared/outcomes.ts';
import { load_invalid_response } from '../shared/errors.ts';
import { makeTrackable, normalizePath } from '../shared/url.ts';
import { fetchData } from './data.ts';
import type { FetchCache } from './fetch.ts';
import type { Intent, Route, Routes } from './routes.ts';
import type { State } from './state.ts';
import type { Transport } from './transport.ts';

export interface Uses {
	dependencies: Set<string>;
	params: Set<string>;
	paramsAll: boolean;
	search: Set<string>;
	parent: boolean;
	route: boolean;
	url: boolean;
}
export interface Branch {
	loader: NodeLoader;
	node: ClientNode;
	server: DataNode | null;
	uses: Uses | null;
	data: Record<string, any>;
	slash?: TrailingSlash;
}
export interface Loaded extends Intent {
	type: 'loaded';
	branch: Array<Branch | undefined>;
	status: number;
	error: App.Error | null;
	form: Record<string, any> | null;
}
export interface Changes {
	all: boolean;
	dependencies: Array<(url: URL) => boolean>;
}
const span = trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
const empty = {};

function uses(value: SerializedUses = {}): Uses {
	return {
		dependencies: new Set(value.dependencies),
		params: new Set(value.params),
		paramsAll: false,
		search: new Set(value.search_params),
		parent: !!value.parent,
		route: !!value.route,
		url: !!value.url
	};
}

function changed(
	usage: Uses | null,
	previous: Loaded | null,
	next: Intent,
	changes: Changes,
	parent: boolean,
	moved: boolean
): boolean {
	if (changes.all) return true;
	if (!usage || !previous) return !previous;
	if (
		(usage.parent && parent) ||
		(usage.route && previous.route.id !== next.route.id) ||
		(usage.url && moved)
	)
		return true;
	if (
		usage.paramsAll &&
		(Object.keys(previous.params).length !== Object.keys(next.params).length ||
			Object.keys(previous.params).some((name) => previous.params[name] !== next.params[name]))
	)
		return true;
	for (const name of usage.params) if (previous.params[name] !== next.params[name]) return true;
	for (const name of usage.search) {
		const before = previous.url.searchParams.getAll(name).sort();
		const after = next.url.searchParams.getAll(name).sort();
		if (before.length !== after.length || before.some((value, index) => value !== after[index]))
			return true;
	}
	for (const dependency of usage.dependencies)
		if (changes.dependencies.some((test) => test(new URL(dependency)))) return true;
	return false;
}

export class Pages {
	readonly app: ClientApp;
	readonly owner: Owner;
	readonly routes: Routes;
	readonly state: State;
	readonly fetches: FetchCache;
	readonly transport: Transport;

	constructor(
		app: ClientApp,
		owner: Owner,
		routes: Routes,
		state: State,
		fetches: FetchCache,
		transport: Transport
	) {
		this.app = app;
		this.owner = owner;
		this.routes = routes;
		this.state = state;
		this.fetches = fetches;
		this.transport = transport;
	}

	async error(error: unknown, intent: NavigationEvent<MatchedParams>): Promise<App.Error> {
		if (error instanceof HandledError) return error.body;
		const caught =
			error instanceof HttpError
				? { kind: 'app' as const, error: error.body }
				: error instanceof FrameworkError
					? { kind: 'framework' as const, error: { status: error.status, message: error.text } }
					: { kind: 'unknown' as const, error };
		const fallback =
			caught.kind === 'unknown' ? { status: 500, message: 'Internal Error' } : caught.error;
		const body = await this.owner.run(() =>
			this.app.hooks.handleError?.({ ...caught, event: intent as NavigationEvent })
		);
		return { ...fallback, ...body };
	}

	async node(
		loader: NodeLoader,
		server: DataNode | null,
		intent: Intent,
		parent: () => Promise<Record<string, any>>
	): Promise<Branch> {
		const node = await this.routes.load(loader);
		const usage = uses();
		let tracking = true;
		let data: Record<string, any> | void;
		const event: LoadEvent<MatchedParams> = {
			url: makeTrackable(
				intent.url,
				() => {
					if (tracking) usage.url = true;
				},
				(name) => {
					if (tracking) usage.search.add(name);
				},
				this.routes.hash
			),
			params: new Proxy(intent.params, {
				get(target, key) {
					if (tracking && typeof key === 'string') usage.params.add(key);
					return Reflect.get(target, key);
				},
				ownKeys(target) {
					if (tracking) usage.paramsAll = true;
					return Reflect.ownKeys(target);
				}
			}),
			route: new Proxy(
				{ id: intent.route.id },
				{
					get(target, key) {
						if (tracking) usage.route = true;
						return Reflect.get(target, key);
					}
				}
			),
			data: server?.data ?? null,
			fetch: async (input, init) => {
				const url = new URL(input instanceof Request ? input.url : input, intent.url);
				if (tracking) usage.dependencies.add(url.href);
				return this.fetches.fetch(input, init, intent.url);
			},
			depends: (...dependencies) => {
				if (tracking)
					for (const dependency of dependencies)
						usage.dependencies.add(new URL(dependency, intent.url).href);
			},
			parent: () => {
				if (tracking) usage.parent = true;
				return parent();
			},
			setHeaders() {},
			untrack: (fn) => {
				const before = tracking;
				tracking = false;
				try {
					return fn();
				} finally {
					tracking = before;
				}
			},
			tracing: { enabled: false, root: span, current: span }
		};
		if (node.universal?.load) {
			data = await this.fetches.load(() =>
				this.owner.run(() => node.universal!.load!(event as LoadEvent))
			);
			if (data != null && Object.getPrototypeOf(data) !== Object.prototype) {
				load_invalid_response({
					location: `related to route '${intent.route.id}'`,
					type:
						typeof data !== 'object'
							? `a ${typeof data}`
							: data instanceof Response
								? 'a Response object'
								: Array.isArray(data)
									? 'an array'
									: 'a non-plain object'
				});
			}
		}
		return {
			loader,
			node,
			server,
			uses: node.universal?.load ? usage : null,
			data: data! ?? server?.data ?? empty,
			slash: node.universal?.trailingSlash ?? server?.slash
		};
	}

	async hydrate(value: HydrationPayload, url: URL): Promise<Loaded | DataRedirectNode> {
		const resolved = value.server_route
			? this.routes.accept(value.server_route)
			: this.routes.get(value.route.id ?? '');
		const route = resolved ?? this.fallback(value.route.id ?? '/');
		const intent: Intent = { route, params: value.params, url };
		const ids: Array<number | undefined> = [...value.node_ids];
		const data = [...value.data];
		resolved?.layouts.forEach((entry, depth) => {
			if (!entry) {
				ids.splice(depth, 0, undefined);
				data.splice(depth, 0, null);
			}
		});
		const pending: Array<Promise<Branch | undefined>> = ids.map((id, index) =>
			id === undefined
				? Promise.resolve(undefined)
				: this.node(this.app.nodes[id]!, data[index] ?? null, intent, async () => {
						const ancestors = await Promise.all(pending.slice(0, index));
						return Object.assign({}, ...ancestors.map((branch) => branch?.data));
					})
		);
		for (const promise of pending) void promise.catch(() => {});
		const branch: Array<Branch | undefined> = [];
		for (let depth = 0; depth < pending.length; depth++) {
			try {
				branch.push(await pending[depth]);
			} catch (error) {
				if (error instanceof Redirect)
					return { type: 'redirect', status: error.status, location: error.location };
				return this.failure(
					intent,
					branch,
					depth,
					await this.error(error, { ...intent, params: intent.params })
				);
			}
		}
		return {
			...intent,
			type: 'loaded',
			branch,
			status: value.status ?? value.error?.status ?? 200,
			error: value.error,
			form: value.form
		};
	}

	async rootError(intent: Intent, error: unknown): Promise<Loaded | DataRedirectNode> {
		return this.#root(
			intent,
			await this.error(error, {
				url: intent.url,
				params: {},
				route: { id: intent.route.id }
			})
		);
	}

	async #root(intent: Intent, body: App.Error): Promise<Loaded | DataRedirectNode> {
		const fallback: Intent = {
			url: intent.url,
			params: {},
			route: { ...this.fallback(intent.route.id), errors: [] }
		};
		let data: DataNode | null = null;
		const response = this.app.serverLoads.includes(0)
			? await fetchData(intent.url, [true], this.transport, this.state).catch(() => null)
			: null;
		if (response) {
			if (response.type === 'redirect') return response;
			const node = response.nodes[0];
			if (node?.type === 'error') throw new HandledError(node.error);
			if (node && node.type !== 'data') throw new HandledError(body);
			data = node ?? null;
		}
		let root: Branch;
		try {
			root = await this.node(this.app.nodes[0]!, data, fallback, async () => ({}));
		} catch (error) {
			if (error instanceof Redirect)
				return { type: 'redirect', status: error.status, location: error.location };
			throw error;
		}
		const loader = this.app.nodes[1]!;
		const leaf: Branch = {
			loader,
			node: await this.routes.load(loader),
			server: null,
			uses: null,
			data: empty
		};
		return {
			...fallback,
			type: 'loaded',
			branch: [root, leaf],
			error: body,
			status: body.status,
			form: null
		};
	}

	fallback(id = '/'): Route {
		return {
			id,
			pattern: /^$/,
			params: [],
			layouts: [[this.app.serverLoads.includes(0), this.app.nodes[0]!]],
			errors: [this.app.nodes[1]],
			leaf: [false, this.app.nodes[1]!]
		};
	}

	async load(
		intent: Intent,
		previous: Loaded | null,
		changes: Changes,
		actionError?: App.Error
	): Promise<Loaded | DataRedirectNode> {
		const entries = [...intent.route.layouts, intent.route.leaf];
		for (const loader of intent.route.errors)
			if (loader) void this.routes.load(loader).catch(() => {});
		for (const entry of entries) if (entry) void this.routes.load(entry[1]).catch(() => {});
		const page = (url: URL) =>
			this.routes.hash ? url.hash.slice(1) + url.search : this.routes.key(url);
		const moved = !!previous && page(previous.url) !== page(intent.url);
		let parent = false;
		const invalid = entries.map((entry, depth) => {
			const old = previous?.branch[depth];
			const reload =
				!(actionError && depth === entries.length - 1) &&
				!!entry?.[0] &&
				(entry[1] !== old?.loader ||
					changed(
						old.server ? uses(old.server.uses) : null,
						previous,
						intent,
						changes,
						parent,
						moved
					));
			parent ||= reload;
			return reload;
		});
		let response: DataResponse | DataRedirectNode | null;
		try {
			response = invalid.some(Boolean)
				? await fetchData(intent.url, invalid, this.transport, this.state)
				: null;
		} catch (error) {
			return this.failure(
				intent,
				[],
				0,
				await this.error(error, {
					url: intent.url,
					route: { id: intent.route.id },
					params: intent.params
				})
			);
		}
		if (response?.type === 'redirect') return response;
		parent = false;
		const pending: Array<Promise<Branch | undefined>> = entries.map((entry, depth) => {
			if (!entry || (actionError && depth === entries.length - 1))
				return Promise.resolve(undefined);
			const old = previous?.branch[depth];
			const data = response?.nodes[depth];
			if (
				old?.loader === entry[1] &&
				(!data || data.type === 'skip') &&
				!changed(old.uses, previous, intent, changes, parent, moved)
			)
				return Promise.resolve(old);
			parent = true;
			if (data?.type === 'error') return Promise.reject(new HandledError(data.error));
			return this.node(
				entry[1],
				data?.type === 'data' ? data : old?.loader === entry[1] ? old.server : null,
				intent,
				async () => {
					const ancestors = await Promise.all(pending.slice(0, depth));
					return Object.assign({}, ...ancestors.map((branch) => branch?.data));
				}
			);
		});
		for (const promise of pending) void promise.catch(() => {});
		const branch: Array<Branch | undefined> = [];
		for (let depth = 0; depth < pending.length; depth++) {
			try {
				branch.push(await pending[depth]);
			} catch (error) {
				if (error instanceof Redirect)
					return { type: 'redirect', status: error.status, location: error.location };
				return this.failure(
					intent,
					branch,
					depth,
					await this.error(error, {
						url: intent.url,
						route: { id: intent.route.id },
						params: intent.params
					})
				);
			}
		}
		if (actionError) return this.failure(intent, branch, entries.length, actionError);
		const url = new URL(intent.url);
		if (!this.routes.hash) {
			let slash: TrailingSlash = 'never';
			for (const node of branch) slash = node?.slash ?? slash;
			url.pathname = normalizePath(url.pathname, slash);
		}
		return { ...intent, url, type: 'loaded', branch, status: 200, error: null, form: null };
	}

	async failure(
		intent: Intent,
		branch: Array<Branch | undefined>,
		depth: number,
		error: App.Error
	): Promise<Loaded | DataRedirectNode> {
		let index = Math.max(0, Math.min(depth - 1, intent.route.errors.length - 1));
		while (index > 0 && !intent.route.errors[index]) index--;
		let loader = intent.route.errors[index] ?? this.app.nodes[1]!;
		let node: ClientNode;
		for (;;) {
			try {
				node = await this.routes.load(loader);
				break;
			} catch (failure) {
				if (index === 0) throw failure;
				do {
					index--;
				} while (index > 0 && !intent.route.errors[index]);
				loader = intent.route.errors[index] ?? this.app.nodes[1]!;
			}
		}
		while (
			index > 0 &&
			(!branch[index] || branch[index]!.loader !== intent.route.layouts[index]?.[1])
		)
			index--;
		const kept = branch.slice(0, index + 1);
		if (!kept[0]) return this.#root(intent, error);
		kept.push({ node, loader, data: {}, server: null, uses: null });
		return { ...intent, type: 'loaded', branch: kept, status: error.status, error, form: null };
	}
}
