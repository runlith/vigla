import type {
	PageNode,
	RequestState,
	RequestStore,
	RespondOptions,
	ServerRoute
} from '../types/internal/server.ts';
import type { RequestEvent } from '../types/request.ts';
import type { ParamValue } from '../types/params.ts';
import type { Server } from './index.ts';
import {
	addDataSuffix,
	addResolutionSuffix,
	hasDataSuffix,
	hasResolutionSuffix,
	stripDataSuffix,
	stripResolutionSuffix
} from '../shared/pathname.ts';
import { decodePathname, normalizePath } from '../shared/url.ts';
import { findRoute } from '../shared/routing/index.ts';
import { isEndpoint, negotiate } from '../shared/http.ts';
import { Redirect } from '../shared/outcomes.ts';
import { uneval } from 'devalue';
import { CookieJar } from './cookies.ts';
import { csrfResponse } from './csrf.ts';
import { ResponseHeaders } from './headers.ts';
import { RequestScope, runRequest } from './scope.ts';
import { createFetch } from './fetch.ts';
import { endpointResponse } from './endpoint.ts';
import { dataResponse } from './data.ts';
import { pageResponse, pageSettings, errorResponse } from './page.ts';
import { resolutionResponse } from './routing.ts';
import { FrameworkError } from './failure.ts';
import { appEvent } from './hooks.ts';
import { renderDocument } from './document.ts';
import { restrictSearch } from './url.ts';

export async function respond(
	server: Server,
	request: Request,
	options: RespondOptions,
	parent?: RequestStore
): Promise<Response> {
	if (request.signal.aborted) throw request.signal.reason;
	if (parent && parent.state.depth >= 20)
		return new Response('Internal request depth exceeded', { status: 508 });
	const url = new URL(request.url);
	const data = hasDataSuffix(url.pathname);
	const resolution = hasResolutionSuffix(url.pathname);
	const remotePrefix = `/${server.manifest.app_path}/remote/`;
	const remote = url.pathname.startsWith(remotePrefix)
		? url.pathname.slice(remotePrefix.length).split('/')
		: null;
	const rejected = server.options.dev
		? null
		: csrfResponse(request, !!remote, server.options.csrf, server.options.paths);
	if (rejected) return rejected;
	if (
		server.options.router.type === 'hash' &&
		url.pathname !== `${server.options.paths.base}/` &&
		url.pathname !== '/[fallback]'
	)
		return new Response('Not found', { status: 404 });
	let invalidated: boolean[] | undefined;
	if (data) {
		url.pathname =
			stripDataSuffix(url.pathname) +
				(url.searchParams.get('x-sveltekit-trailing-slash') === '1' ? '/' : '') || '/';
		url.searchParams.delete('x-sveltekit-trailing-slash');
		const mask =
			url.searchParams.get('x-sveltekit-invalidated') ??
			request.headers.get('x-sveltekit-invalidated');
		invalidated = mask?.split('').map((value) => value === '1');
		url.searchParams.delete('x-sveltekit-invalidated');
	} else if (resolution) url.pathname = stripResolutionSuffix(url.pathname) || '/';
	else if (remote && request.headers.has('x-sveltekit-pathname')) {
		url.pathname = request.headers.get('x-sveltekit-pathname')!;
		url.search = request.headers.get('x-sveltekit-search') ?? '';
	}
	for (const key of url.searchParams.keys())
		if (key.startsWith('x-sveltekit-'))
			return new Response(`Cannot use reserved query parameter "${key}"`, { status: 400 });
	const headers = new ResponseHeaders(server.options.dev);
	const jar = new CookieJar(request, url, server.options.dev, server.cookiePaths);
	const state: RequestState = {
		read: options.read ?? server.read,
		emulator: options.emulator,
		depth: (parent?.state.depth ?? -1) + 1,
		error: false,
		rerouted: null,
		prerendering: options.prerendering,
		fetched: [],
		resolveOptions: {},
		isRendering: false,
		active: true
	};
	restrictSearch(url, state);
	const event = {
		cookies: jar.cookies,
		fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
		getClientAddress: options.getClientAddress,
		locals: {},
		params: {},
		platform: options.emulator?.platform
			? await options.emulator.platform({ config: {}, prerender: !!state.prerendering?.fallback })
			: options.platform,
		request,
		route: { id: null as string | null },
		setHeaders: headers.set,
		url,
		isDataRequest: data,
		isSubRequest: !!parent,
		isRemoteRequest: !!remote,
		tracing: {
			enabled: server.options.tracing.server,
			root: parent?.event.tracing.root ?? server.tracer.current(),
			current: server.tracer.current()
		}
	} satisfies RequestEvent<Record<string, ParamValue>>;
	const scope = new RequestScope(server, event, state, server.scope, parent);
	event.fetch = createFetch(server, scope.store, jar);
	let route: ServerRoute | undefined;
	let nodes: Array<PageNode | undefined> = [];
	try {
		if (state.prerendering?.fallback) {
			jar.route('ignore');
			return finish(
				await renderDocument(server, scope.store, {
					branch: [],
					errors: [],
					status: 200,
					error: null,
					form: null,
					ssr: false,
					csr: true
				})
			);
		}
		let path = url.pathname;
		if (!remote && server.hooks.reroute && !path.includes(`/${server.manifest.app_dir}/routes/`)) {
			const before = state.prerendering?.insideReroute;
			try {
				if (state.prerendering) state.prerendering.insideReroute = true;
				path =
					(await scope.run(() =>
						server.hooks.reroute!({ url: new URL(url), fetch: event.fetch })
					)) ?? path;
				if (path !== url.pathname) state.rerouted = new URL(path, url).href;
			} finally {
				if (state.prerendering) state.prerendering.insideReroute = before ?? false;
			}
		}
		try {
			path = decodePathname(path);
		} catch {
			throw new FrameworkError(400, 'Malformed URI');
		}
		if (
			!state.prerendering?.fallback &&
			path !== decodePathname(url.pathname) &&
			(server.manifest.prerendered_routes.has(path) ||
				(path.endsWith('/') && server.manifest.prerendered_routes.has(path.slice(0, -1))))
		) {
			const target = new URL(request.url);
			target.pathname = data ? addDataSuffix(path) : resolution ? addResolutionSuffix(path) : path;
			const response = await fetch(new Request(target, request), { redirect: 'manual' });
			const headers = new Headers(response.headers);
			if (headers.has('content-encoding')) {
				headers.delete('content-encoding');
				headers.delete('content-length');
			}
			state.rerouted = target.href;
			return finish(
				new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers
				})
			);
		}
		const base = server.options.paths.base;
		if (base && path !== base && !path.startsWith(`${base}/`) && !state.prerendering?.fallback)
			return finish(new Response('Not found', { status: 404 }));
		path = path.slice(base.length) || '/';
		if (resolution) return finish(await resolutionResponse(server, path, new URL(request.url)));
		if (path === `/${server.manifest.app_dir}/env.js`)
			return finish(
				new Response(`export const env=${uneval(server.environment.rendered)};`, {
					headers: { 'content-type': 'application/javascript' }
				})
			);
		if (path.startsWith(`/${server.manifest.app_dir}/immutable/`))
			return finish(
				new Response('Not found', {
					status: 404,
					headers: { 'cache-control': 'public, max-age=31536000, immutable' }
				})
			);
		const match =
			remote && !request.headers.has('x-sveltekit-pathname')
				? null
				: findRoute(path, server.manifest.routes, await server.manifest.matchers());
		route = match?.route;
		if (match) {
			event.route = { id: match.route.id };
			event.params = match.params;
		}
		if (route?.page)
			nodes = await Promise.all(
				[...route.page.layouts, route.page.leaf].map((id) =>
					id == null ? undefined : server.manifest.nodes[id]!()
				)
			);
		const endpoint = route?.endpoint ? await route.endpoint() : null;
		const useEndpoint = !!endpoint && (!route?.page || isEndpoint(request));
		const slash = remote
			? 'ignore'
			: useEndpoint
				? (endpoint!.trailingSlash ?? 'never')
				: pageSettings(nodes).trailingSlash;
		if (options.emulator?.platform && route) {
			const config = endpoint
				? (endpoint.config ?? {})
				: Object.assign(
						{},
						...nodes.flatMap((node) => [node?.server?.config, node?.universal?.config])
					);
			const prerender = endpoint ? (endpoint.prerender ?? false) : pageSettings(nodes).prerender;
			if (!endpoint) state.prerenderDefault = prerender;
			event.platform = await options.emulator.platform({ config, prerender });
		}
		let resolved = false;
		const resolve = async (
			resolvedEvent: RequestEvent<Record<string, ParamValue>>,
			resolveOptions = {}
		): Promise<Response> => {
			if (resolved) throw new Error('resolve() has already been called');
			resolved = true;
			state.resolveOptions = resolveOptions;
			jar.route(slash);
			const resolvedUrl = new URL(resolvedEvent.url);
			if (data) {
				resolvedUrl.pathname = normalizePath(resolvedUrl.pathname, slash);
				restrictSearch(resolvedUrl, state);
			}
			const store = {
				...scope.store,
				event: data ? { ...resolvedEvent, url: resolvedUrl } : resolvedEvent
			};
			try {
				const normalized = normalizePath(url.pathname, slash);
				if (!data && !remote && normalized !== url.pathname && !state.prerendering?.fallback) {
					const location = new URL(url);
					location.pathname = normalized;
					return new Response(null, {
						status: 308,
						headers: {
							location: location.pathname.startsWith('//')
								? location.href
								: location.pathname + location.search,
							'x-sveltekit-normalize': '1'
						}
					});
				}
				if (remote) {
					if (!server.options.remote)
						return new Response('Remote functions are not implemented', { status: 501 });
					return await runRequest(
						store,
						() =>
							server.options.remote!({
								id: remote[0] ?? '',
								name: remote[1] ?? '',
								argument: remote[2],
								store
							}),
						server.scope
					);
				}
				if (!route) return await errorResponse(server, store, new FrameworkError(404, 'Not Found'));
				if (data) return await dataResponse(server, store, route, invalidated);
				if (useEndpoint) return await endpointResponse(server, store, endpoint!);
				if (!route.page)
					return await errorResponse(server, store, new FrameworkError(404, 'Not Found'));
				if (request.method === 'OPTIONS')
					return new Response(null, {
						status: 204,
						headers: { allow: `GET, HEAD, OPTIONS${nodes.at(-1)?.server?.actions ? ', POST' : ''}` }
					});
				if (!['GET', 'HEAD', 'POST'].includes(request.method))
					return new Response(`${request.method} method not allowed`, {
						status: 405,
						headers: { allow: 'GET, HEAD' }
					});
				return await pageResponse(server, store, route, nodes);
			} finally {
				headers.seal();
				jar.seal();
			}
		};
		const response = await server.tracer.span(
			'sveltekit.handle',
			{ 'http.route': event.route.id ?? 'unknown', 'http.method': request.method },
			async (span) => {
				event.tracing = {
					enabled: server.options.tracing.server,
					root: parent?.event.tracing.root ?? event.tracing.root,
					current: span
				};
				return scope.run(() =>
					server.hooks.handle
						? server.hooks.handle({ event: appEvent(event), resolve })
						: resolve(event)
				);
			}
		);
		if (!(response instanceof Response)) throw new Error('The handle hook must return a Response');
		return finish(response, !!route?.page && !!endpoint);
	} catch (error) {
		if (request.signal.aborted) {
			scope.close();
			throw request.signal.reason;
		}
		try {
			if (error instanceof Redirect) {
				const response = data
					? Response.json({ type: 'redirect', status: error.status, location: error.location })
					: request.method === 'POST' &&
						  negotiate(request.headers.get('accept') ?? '*/*', [
								'application/json',
								'text/html'
						  ]) === 'application/json'
						? Response.json({ type: 'redirect', status: error.status, location: error.location })
						: new Response(null, { status: error.status, headers: { location: error.location } });
				return finish(response);
			}
			return finish(await errorResponse(server, scope.store, error, route));
		} catch (fatal) {
			scope.close();
			throw fatal;
		}
	}

	function finish(response: Response, vary = false): Response {
		const location = response.headers.get('location');
		if (data && response.status >= 300 && response.status <= 308 && location) {
			void response.body?.cancel().catch(() => {});
			const headers = new Headers(response.headers);
			headers.delete('location');
			headers.delete('content-length');
			headers.set('content-type', 'application/json');
			response = Response.json(
				{ type: 'redirect', status: response.status, location },
				{ headers }
			);
		}
		jar.route('ignore');
		jar.seal();
		headers.seal();
		const result = new Headers(response.headers);
		for (const [name, value] of headers.values) result.set(name, value);
		jar.apply(result);
		if (
			vary &&
			!result
				.get('vary')
				?.split(',')
				.some((name) => name.trim().toLowerCase() === 'accept')
		)
			result.append('vary', 'Accept');
		if (state.rerouted) result.set('x-sveltekit-rerouted-url', state.rerouted);
		if (state.prerendering && event.route.id)
			result.set('x-sveltekit-routeid', encodeURI(event.route.id));
		const etag = result.get('etag');
		if (etag && request.headers.get('if-none-match')?.replace(/^W\//, '') === etag) {
			void response.body?.cancel().catch(() => {});
			return scope.response(new Response(null, { status: 304, headers: result }));
		}
		if (request.method === 'HEAD') {
			void response.body?.cancel().catch(() => {});
			return scope.response(
				new Response(null, {
					status: response.status,
					statusText: response.statusText,
					headers: result
				})
			);
		}
		return scope.response(
			new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: result
			})
		);
	}
}
