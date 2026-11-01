import type {
	ClientApp,
	MatchedParams,
	NodeLoader,
	ServerRoute
} from '../types/internal/client.ts';
import type { RoutePattern } from '../types/internal/routes.ts';
import { findRoute, parseRoute } from '../shared/routing/index.ts';
import { addResolutionSuffix } from '../shared/pathname.ts';
import { decodePathname } from '../shared/url.ts';
import { base, appDir, hashRouting } from './payload.ts';
import { preload_invalid_route_id } from './errors.ts';
import { preload_route_missing, preload_route_is_pathname } from './warnings.ts';

export type NodeEntry = [server: boolean, loader: NodeLoader];
export interface Route extends RoutePattern {
	id: string;
	layouts: Array<NodeEntry | undefined>;
	errors: Array<NodeLoader | undefined>;
	leaf: NodeEntry;
}
export interface Intent {
	url: URL;
	route: Route;
	params: MatchedParams;
}

const stylesheets = new WeakMap<Document, Map<string, Promise<void>>>();

export function loadCss(dependencies: string[]): Promise<void> {
	let pending = stylesheets.get(document);
	if (!pending) stylesheets.set(document, (pending = new Map()));
	const cache = pending;
	return Promise.all(
		dependencies.map((dependency) => {
			const href = new URL(dependency, document.baseURI).href;
			const current = cache.get(href);
			if (current) return current;
			const existing = [...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')].find(
				(link) => link.href === href
			);
			if (existing?.sheet) return;
			const promise = new Promise<void>((resolve, reject) => {
				const link = existing ?? document.createElement('link');
				link.addEventListener('load', () => resolve(), { once: true });
				link.addEventListener(
					'error',
					() => {
						cache.delete(href);
						link.remove();
						reject(new Error(`Unable to load CSS: ${href}`));
					},
					{ once: true }
				);
				if (!existing) {
					link.rel = 'stylesheet';
					link.href = href;
					link.crossOrigin = '';
					const nonce = document.querySelector<HTMLMetaElement>('meta[property=csp-nonce]')?.nonce;
					if (nonce) link.nonce = nonce;
					document.head.append(link);
				}
			});
			cache.set(href, promise);
			return promise;
		})
	).then(() => {});
}

export class Routes {
	readonly hash = hashRouting;
	readonly #app: ClientApp;
	readonly #routes: Route[];
	readonly #byId = new Map<string, Route>();
	readonly #code = new Map<NodeLoader, ReturnType<NodeLoader>>();
	readonly #rerouted = new Map<string, Promise<string>>();

	constructor(app: ClientApp) {
		this.#app = app;
		const servers = new Set(app.serverLoads);
		this.#routes = Object.entries(app.dictionary).map(([id, [leaf, layouts, errors]]) => {
			const branch = [0, ...layouts];
			const failures = [1, ...(errors ?? [])];
			branch.length = failures.length = Math.max(branch.length, failures.length);
			const route: Route = {
				id,
				...parseRoute(id),
				layouts: Array.from(branch, (index) =>
					index === undefined ? undefined : ([servers.has(index), app.nodes[index]!] as NodeEntry)
				),
				errors: Array.from(failures, (index) =>
					index === undefined ? undefined : app.nodes[index]
				),
				leaf: [leaf < 0, app.nodes[leaf < 0 ? ~leaf : leaf]!]
			};
			this.#byId.set(id, route);
			return route;
		});
	}

	outside(url: URL): boolean {
		if (url.origin !== location.origin) return true;
		if (this.hash) return url.pathname !== location.pathname;
		return url.pathname !== base && !url.pathname.startsWith(`${base}/`);
	}

	key(url: URL): string {
		return this.hash ? url.hash.slice(1).split('#')[0]! + url.search : url.pathname + url.search;
	}

	async match(url: URL): Promise<Intent | null> {
		if (this.outside(url)) return null;
		let path = this.hash ? url.hash.slice(1).split(/[?#]/)[0] || '/' : url.pathname;
		if (this.#app.hooks.reroute) {
			let rerouted = this.#rerouted.get(url.href);
			if (!rerouted) {
				rerouted = Promise.resolve()
					.then(() => this.#app.hooks.reroute!({ url: new URL(url), fetch }))
					.then((result) => result ?? path);
				this.#rerouted.set(url.href, rerouted);
				rerouted.catch(() => this.#rerouted.delete(url.href));
			}
			try {
				path = await rerouted;
			} catch {
				return null;
			}
		}
		if (this.#app.clientRouting === false) {
			const module: { route?: ServerRoute; params?: MatchedParams } = await import(
				/* @vite-ignore */ addResolutionSuffix(path)
			);
			return module.route
				? { url, route: this.accept(module.route), params: module.params ?? {} }
				: null;
		}
		const found = findRoute(
			decodePathname(this.hash ? path : path.slice(base.length)) || '/',
			this.#routes,
			this.#app.matchers
		);
		return found ? { url, ...found } : null;
	}

	accept(value: ServerRoute): Route {
		for (const [index, loader] of Object.entries(value.nodes)) this.#app.nodes[+index] ??= loader;
		const entry = (value: [boolean, number]): NodeEntry => [value[0], this.#app.nodes[value[1]]!];
		const route: Route = {
			id: value.id,
			...parseRoute(value.id),
			layouts: Array.from(value.layouts, (node) => node && entry(node)),
			errors: Array.from(value.errors, (node) =>
				node === undefined ? undefined : this.#app.nodes[node]
			),
			leaf: entry(value.leaf)
		};
		this.#byId.set(value.id, route);
		return route;
	}

	get(id: string): Route | undefined {
		return this.#byId.get(id);
	}

	load(loader: NodeLoader): ReturnType<NodeLoader> {
		let promise = this.#code.get(loader);
		if (!promise) {
			promise = loader().then(async (node) => {
				if (node.stylesheets?.length) await loadCss(node.stylesheets);
				return node;
			});
			this.#code.set(loader, promise);
			promise.catch(() => this.#code.delete(loader));
		}
		return promise;
	}

	async preload(id: string): Promise<void> {
		if (!id.startsWith('/')) preload_invalid_route_id({ id });
		let route = this.#byId.get(id);
		if (!route && this.#app.clientRouting === false) {
			try {
				const path = addResolutionSuffix(`${base}/${appDir}/routes${id === '/' ? '' : id}`);
				const module: { route?: ServerRoute } = await import(/* @vite-ignore */ path);
				if (module.route) route = this.accept(module.route);
			} catch {}
		}
		if (!route) {
			if (await this.match(new URL(`${base}${id}`, location.href)))
				preload_route_is_pathname({ id });
			else preload_route_missing({ id });
			return;
		}
		await Promise.all([...route.layouts, route.leaf].map((entry) => entry && this.load(entry[1])));
	}
}
