import type { PageNode, RequestStore, ServerRoute } from '../types/internal/server.ts';
import type { TrailingSlash } from '../types/internal/data.ts';
import type { Server } from './index.ts';
import type { LoadedNode } from './load.ts';
import { HttpError, Redirect } from '../shared/outcomes.ts';
import { negotiate } from '../shared/http.ts';
import { escapeHtml } from '../shared/escape.ts';
import { renderDocument } from './document.ts';
import { loadBranch, serverLoad, universalLoad } from './load.ts';
import { actionResponse, runAction, wantsActionJson, type ActionResult } from './actions.ts';
import { FrameworkError, handleError } from './failure.ts';
import * as errors from './errors.ts';
import * as warnings from './warnings.ts';

export interface PageSettings {
	ssr: boolean;
	csr: boolean;
	prerender: boolean | 'auto';
	trailingSlash: TrailingSlash;
}

export function pageSettings(nodes: Array<PageNode | undefined>): PageSettings {
	const settings: PageSettings = { ssr: true, csr: true, prerender: false, trailingSlash: 'never' };
	for (const node of nodes)
		for (const module of [node?.server, node?.universal]) {
			if (module?.ssr !== undefined) settings.ssr = module.ssr;
			if (module?.csr !== undefined) settings.csr = module.csr;
			if (module?.prerender !== undefined) settings.prerender = module.prerender;
			if (module?.trailingSlash !== undefined) settings.trailingSlash = module.trailingSlash;
		}
	return settings;
}

export async function pageResponse(
	server: Server,
	store: RequestStore,
	route: ServerRoute,
	nodes: Array<PageNode | undefined>
): Promise<Response> {
	const settings = pageSettings(nodes);
	const { event, state } = store;
	state.prerenderDefault = settings.prerender;
	const leaf = nodes.at(-1);
	if (settings.prerender && leaf?.server?.actions) errors.prerender_actions();
	if (state.prerendering && !state.prerendering.fallback && !settings.prerender)
		return new Response(null, { status: 204 });
	if (wantsActionJson(event.request))
		return actionResponse(server, store, await runAction(server, store, leaf?.server));
	let form: unknown = null;
	let status = 200;
	let action: ActionResult | undefined;
	if (event.request.method === 'POST') {
		const result = (action = await runAction(server, store, leaf?.server));
		if (result.type === 'redirect')
			return new Response(null, { status: result.status, headers: { location: result.location } });
		if (result.type === 'error') {
			if (!settings.ssr && server.options.dev) warnings.form_action_error_without_ssr();
			status =
				result.error instanceof HttpError || result.error instanceof FrameworkError
					? result.error.status
					: 500;
		} else {
			form = result.data;
			status = result.status;
		}
		if (!settings.ssr && form && server.options.dev) warnings.form_action_data_without_ssr();
	}
	const branch: LoadedNode[] = settings.ssr
		? []
		: nodes.flatMap((node, depth) => (node ? [{ depth, node, server: null, data: null }] : []));
	if (settings.ssr) {
		const pending = loadBranch(server, store, nodes, settings.csr, action);
		for (const [index, load] of pending.entries()) {
			try {
				const result = await load;
				if (result) branch.push(result);
			} catch (error) {
				if (error instanceof Redirect)
					return new Response(null, {
						status: error.status,
						headers: { location: error.location }
					});
				return errorResponse(server, store, error, route, branch, index);
			}
		}
	}
	const errorNodes = await Promise.all(
		(route.page?.errors ?? []).map((index) =>
			index == null ? undefined : server.manifest.nodes[index]!()
		)
	);
	try {
		const response = await renderDocument(server, store, {
			branch,
			errors: errorNodes,
			status,
			error: null,
			form,
			ssr: settings.ssr,
			csr: settings.csr
		});
		if (state.prerendering)
			response.headers.set('x-sveltekit-prerender', String(settings.prerender));
		return response;
	} catch (error) {
		return errorResponse(server, store, error, route, branch, nodes.length - 1);
	}
}

export async function errorResponse(
	server: Server,
	store: RequestStore,
	failure: unknown,
	route?: ServerRoute,
	branch: LoadedNode[] = [],
	failed?: number
): Promise<Response> {
	if (failure instanceof Redirect)
		return new Response(null, { status: failure.status, headers: { location: failure.location } });
	const body = await handleError(store, failure);
	const { event, state } = store;
	if (!state.error && !event.request.headers.has('x-sveltekit-error')) {
		state.error = true;
		try {
			const candidates = route?.page?.errors ?? [1];
			const boundary = failed === undefined ? 0 : failed - 1;
			for (let depth = Math.min(boundary, candidates.length - 1); depth >= 0; depth--) {
				const id = candidates[depth];
				if (id == null) continue;
				const node = await server.manifest.nodes[id]!();
				if (!node.component) continue;
				let prefix = branch.filter((loaded) => loaded.depth <= depth);
				if (!prefix.length && server.manifest.nodes[0]) {
					const root = await server.manifest.nodes[0]();
					const data = await serverLoad(server, store, root, async () => ({}));
					const universal = await universalLoad(
						server,
						store,
						root,
						Promise.resolve(data),
						async () => ({}),
						true
					);
					prefix = [{ depth: 0, node: root, server: data, data: universal }];
				}
				const settings = pageSettings(prefix.map((loaded) => loaded.node));
				return await renderDocument(server, store, {
					branch: [...prefix, { depth: depth + 1, node, server: null, data: null }],
					errors: [],
					status: body.status,
					error: body,
					form: null,
					ssr: settings.ssr,
					csr: settings.csr
				});
			}
		} catch (error) {
			if (error instanceof Redirect)
				return new Response(null, {
					status: error.status,
					headers: { location: error.location }
				});
			if (!(error instanceof FrameworkError)) console.error(error);
		}
	}
	return staticErrorPage(server, body);
}

export async function fatalResponse(
	server: Server,
	store: RequestStore,
	failure: unknown
): Promise<Response> {
	const body = await handleError(store, failure);
	const accept = negotiate(store.event.request.headers.get('accept') || 'text/html', [
		'application/json',
		'text/html'
	]);
	if (store.event.isDataRequest || accept === 'application/json')
		return Response.json(body, { status: body.status });
	return staticErrorPage(server, body);
}

function staticErrorPage(server: Server, body: App.Error): Response {
	return new Response(
		server.options.templates.error({ status: body.status, message: escapeHtml(body.message) }),
		{ status: body.status, headers: { 'content-type': 'text/html; charset=utf-8' } }
	);
}
