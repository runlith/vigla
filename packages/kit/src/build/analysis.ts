import { resolveRoute } from '../shared/routing/index.ts';
import { invalid_export } from '../shared/errors.ts';
import type { HttpMethod, PrerenderOption } from '../types/builder.ts';
import type { PageNode, ServerManifest } from '../types/internal/server.ts';
import type { Analysis, RemoteMetadata, RouteMetadata } from './types.ts';
import * as e from './messages.ts';

const endpointMethods: HttpMethod[] = [
	'GET',
	'HEAD',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'QUERY'
];
const common = ['load', 'ssr', 'csr', 'prerender', 'trailingSlash', 'config'];

function exportsOf(module: object | undefined, valid: string[], file?: string): void {
	if (!module) return;
	for (const key of Object.keys(module))
		if (!key.startsWith('_') && !valid.includes(key))
			invalid_export({ key, exports: valid.join(', '), file });
}

export async function analyse(manifest: ServerManifest, hash: boolean): Promise<Analysis> {
	const result: Analysis = { nodes: [], routes: new Map(), remotes: new Map(), environment: {} };
	const nodes = await Promise.all(manifest.nodes.map((load) => load()));
	for (const node of nodes) {
		result.nodes[node.index] = {
			hasServerLoad: !!node.server?.load || node.server?.trailingSlash !== undefined,
			hasUniversalLoad: !!node.universal?.load
		};
		if (hash && node.universal) {
			const options = Object.keys(node.universal).filter((key) => key !== 'load');
			if (options.length)
				e.router_hash_page_options({ file: node.universal_id ?? '', options: options.join(', ') });
		}
	}
	const names = new Set(
		manifest.routes.flatMap((route) =>
			route.params.flatMap((param) => (param.matcher ? [param.matcher] : []))
		)
	);
	if (names.size) {
		const matchers = await manifest.matchers();
		if (!matchers || typeof matchers !== 'object') e.params_export_missing();
		for (const name of names) if (!Object.hasOwn(matchers, name)) e.param_matcher_missing({ name });
	}
	for (const route of manifest.routes) {
		const chain: PageNode[] = route.page
			? [...route.page.layouts, route.page.leaf].flatMap((index) =>
					index === undefined ? [] : [nodes[index]!]
				)
			: [];
		let pagePrerender: PrerenderOption = false;
		let pageConfig: Record<string, any> = {};
		for (const node of chain) {
			const leaf = node.index === route.page?.leaf;
			exportsOf(node.universal, [...common, ...(leaf ? ['entries'] : [])], node.universal_id);
			exportsOf(node.server, [...common, ...(leaf ? ['entries', 'actions'] : [])], node.server_id);
			pagePrerender = node.universal?.prerender ?? node.server?.prerender ?? pagePrerender;
			pageConfig = { ...pageConfig, ...node.server?.config, ...node.universal?.config };
		}
		const leaf = chain.at(-1);
		if (pagePrerender && leaf?.server?.actions) e.prerender_actions({ id: route.id });
		const endpoint = route.endpoint ? await route.endpoint() : null;
		const endpointPrerender = endpoint?.prerender ?? false;
		const apiMethods: Array<HttpMethod | '*'> = endpoint
			? endpointMethods.filter((method) => method in endpoint)
			: [];
		if (endpoint?.fallback) apiMethods.push('*');
		exportsOf(
			endpoint ?? undefined,
			[...endpointMethods, 'fallback', 'prerender', 'trailingSlash', 'config', 'entries'],
			route.endpoint_id
		);
		if (
			endpointPrerender &&
			apiMethods.some((method) => !['GET', 'HEAD', 'OPTIONS'].includes(method))
		)
			e.prerender_endpoint_methods({ id: route.id });
		if (pagePrerender && endpointPrerender) e.route_prerender_page_and_endpoint({ id: route.id });
		if (route.page && endpoint?.config) {
			for (const key of Object.keys({ ...pageConfig, ...endpoint.config }))
				if (JSON.stringify(pageConfig[key]) !== JSON.stringify(endpoint.config[key]))
					e.route_config_mismatch({ id: route.id });
		}
		const pageMethods: Array<'GET' | 'POST'> = route.page
			? ['GET', ...(leaf?.server?.actions ? ['POST' as const] : [])]
			: [];
		const generator = leaf?.universal?.entries ?? leaf?.server?.entries ?? endpoint?.entries;
		const metadata: RouteMetadata = {
			config: route.page ? pageConfig : (endpoint?.config ?? {}),
			methods: [...new Set([...pageMethods, ...apiMethods])],
			page: { methods: pageMethods },
			api: { methods: apiMethods },
			prerender: route.page ? pagePrerender : endpointPrerender,
			entries: generator
				? (await generator()).map((params) => resolveRoute(route.id, params))
				: undefined
		};
		result.routes.set(route.id, metadata);
	}
	for (const [id, load] of Object.entries(manifest.remotes)) {
		const { default: functions } = await load();
		const exports = new Map<string, RemoteMetadata>();
		for (const [name, value] of Object.entries(functions)) {
			const internals = value.__;
			exports.set(name, {
				type: internals.type,
				dynamic: internals.type !== 'prerender' || !!internals.dynamic
			});
		}
		result.remotes.set(id, exports);
	}
	return result;
}
