import type { Endpoint, RequestStore } from '../types/internal/server.ts';
import { methods } from '../shared/http.ts';
import { Redirect } from '../shared/outcomes.ts';
import type { Server } from './index.ts';
import { runRequest } from './scope.ts';
import * as errors from './errors.ts';

export function allowedMethods(endpoint: Endpoint): string[] {
	const allowed = methods.filter((method) => endpoint[method]);
	if (endpoint.GET && !endpoint.HEAD) allowed.splice(allowed.indexOf('GET') + 1, 0, 'HEAD');
	return allowed;
}

export async function endpointResponse(
	server: Server,
	store: RequestStore,
	endpoint: Endpoint
): Promise<Response> {
	const { event, state } = store;
	const method = event.request.method;
	let handler = endpoint[method as keyof Endpoint];
	if (method === 'HEAD' && !endpoint.HEAD) handler = endpoint.GET;
	if (typeof handler !== 'function') handler = endpoint.fallback;
	const allowed = allowedMethods(endpoint);
	if (typeof handler !== 'function') {
		if (method === 'OPTIONS')
			return new Response(null, {
				status: 204,
				headers: { allow: [...allowed, 'OPTIONS'].join(', ') }
			});
		return new Response(`${method} method not allowed`, {
			status: 405,
			headers: { allow: allowed.join(', ') }
		});
	}
	const prerender = endpoint.prerender ?? state.prerenderDefault;
	if (
		prerender &&
		(endpoint.fallback ||
			['POST', 'PUT', 'PATCH', 'DELETE'].some((method) => endpoint[method as keyof Endpoint]))
	)
		errors.prerender_endpoint_methods({
			methods: 'POST, PUT, PATCH, DELETE',
			id: event.route.id ?? ''
		});
	if (state.prerendering && !state.prerendering.insideReroute && !prerender) {
		if (state.depth) errors.prerender_endpoint_not_prerenderable({ id: event.route.id ?? '' });
		return new Response(null, { status: 204 });
	}
	try {
		const response = await server.tracer.span(
			'sveltekit.endpoint',
			{ 'http.route': event.route.id ?? 'unknown', 'http.method': method },
			async (span) => {
				const traced = { ...event, tracing: { ...event.tracing, current: span } };
				return runRequest(
					{ ...store, event: traced },
					() => (handler as NonNullable<Endpoint['GET']>)(traced),
					server.scope
				);
			}
		);
		if (!(response instanceof Response))
			errors.endpoint_invalid_response({ path: event.url.pathname });
		if (!state.prerendering) return response;
		const headers = new Headers(response.headers);
		headers.set('x-sveltekit-prerender', String(prerender));
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	} catch (error) {
		if (error instanceof Redirect)
			return new Response(null, { status: error.status, headers: { location: error.location } });
		throw error;
	}
}
