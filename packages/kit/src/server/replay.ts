import type { Fetched, RequestStore } from '../types/internal/server.ts';
import type { Server } from './index.ts';
import { base64, hashRequest } from '../shared/hash.ts';
import { escapeHtml, escapeJson } from '../shared/escape.ts';
import * as errors from './errors.ts';

export function replayFetch(server: Server, store: RequestStore, csr: boolean): typeof fetch {
	const execute: typeof fetch = async (input, init) => {
		const { event, state } = store;
		const url = new URL(input instanceof Request ? input.url : input, event.url);
		const requestHeaders =
			input instanceof Request
				? [...input.headers].length
					? new Headers(input.headers)
					: undefined
				: init?.headers
					? new Headers(init.headers)
					: undefined;
		const requestBody =
			input instanceof Request && input.body ? input.clone().text() : Promise.resolve(init?.body);
		let response = await event.fetch(input, init);
		const sameOrigin = url.origin === event.url.origin;
		if (!sameOrigin && /^https?:$/.test(url.protocol)) {
			const mode = input instanceof Request ? input.mode : (init?.mode ?? 'cors');
			if (mode === 'no-cors')
				response = new Response(null, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers
				});
			else {
				const origin = response.headers.get('access-control-allow-origin');
				if (origin !== '*' && origin !== event.url.origin)
					errors.load_fetch_cors({ reason: origin ? 'Incorrect' : 'No' });
			}
		}
		const dependency =
			state.prerendering && sameOrigin
				? { response, body: null as string | Uint8Array | null }
				: null;
		if (dependency) state.prerendering!.dependencies.set(url.pathname, dependency);
		const wrap = (response: Response): Response => {
			let recorded = false;
			let body: ReadableStream<Uint8Array> | null = null;
			const capture = async (value: string, bytes?: Uint8Array): Promise<void> => {
				if (recorded) return;
				recorded = true;
				if (dependency) dependency.body = bytes ?? value;
				const request = await requestBody;
				if (request && typeof request !== 'string' && !ArrayBuffer.isView(request)) return;
				if (csr)
					state.fetched.push({
						url: sameOrigin ? url.href.slice(url.origin.length) : url.href,
						method: event.request.method,
						request_headers: requestHeaders,
						request_body: request as string | ArrayBufferView | undefined,
						response,
						response_body: value,
						is_b64: !!bytes
					});
			};
			const text = async (): Promise<string> => {
				const value = await response.text();
				await capture(value);
				return value;
			};
			const headers = new Proxy(response.headers, {
				get(target, key) {
					if (csr && key === 'get')
						return (name: string) => {
							const value = target.get(name);
							if (
								value &&
								!name.toLowerCase().startsWith('x-sveltekit-') &&
								!state.resolveOptions.filterSerializedResponseHeaders?.(name.toLowerCase(), value)
							)
								errors.load_response_header_not_serialized({
									name: name.toLowerCase(),
									id: event.route.id ?? ''
								});
							return value;
						};
					if (csr && key === 'getSetCookie')
						return () => {
							const values = target.getSetCookie();
							for (const value of values)
								if (!state.resolveOptions.filterSerializedResponseHeaders?.('set-cookie', value))
									errors.load_response_header_not_serialized({
										name: 'set-cookie',
										id: event.route.id ?? ''
									});
							return values;
						};
					const value = Reflect.get(target, key, target);
					return typeof value === 'function' ? value.bind(target) : value;
				}
			});
			return new Proxy(response, {
				get(target, key) {
					if (key === 'headers') return headers;
					if (key === 'text') return text;
					if (key === 'json')
						return async () => {
							const value = await text();
							return value ? JSON.parse(value) : undefined;
						};
					if (key === 'arrayBuffer')
						return async () => {
							const value = await target.arrayBuffer();
							const bytes = new Uint8Array(value);
							await capture(base64(bytes), bytes);
							return value;
						};
					if (key === 'clone') return () => wrap(target.clone());
					if (key === 'body') {
						if (!target.body) return null;
						if (!body) {
							const [recording, consuming] = target.body.tee();
							body = consuming;
							void new Response(recording)
								.arrayBuffer()
								.then((value) => {
									const bytes = new Uint8Array(value);
									return capture(base64(bytes), bytes);
								})
								.catch(() => {});
						}
						return body;
					}
					const value = Reflect.get(target, key, target);
					return typeof value === 'function' ? value.bind(target) : value;
				}
			});
		};
		return wrap(response);
	};
	return (input, init) => {
		const pending = execute(input, init);
		pending.catch(() => {});
		return pending;
	};
}

export function serializeFetched(
	fetched: Fetched,
	filter: (name: string, value: string) => boolean,
	prerender: boolean
): string {
	const headers = Object.fromEntries(
		[...fetched.response.headers].filter(([name, value]) => filter(name, value))
	);
	const attributes = [
		'type="application/json"',
		'data-sveltekit-fetched',
		`data-url="${escapeHtml(fetched.url, true)}"`
	];
	if (fetched.is_b64) attributes.push('data-b64');
	if (fetched.request_headers || fetched.request_body)
		attributes.push(`data-hash="${hashRequest(fetched.request_headers, fetched.request_body)}"`);
	const cache = fetched.response.headers.get('cache-control');
	if (
		!prerender &&
		fetched.method === 'GET' &&
		fetched.response.headers.get('vary')?.trim() !== '*' &&
		cache
	) {
		const maxAge = /s-maxage=(\d+)/.exec(cache) ?? /max-age=(\d+)/.exec(cache);
		if (maxAge)
			attributes.push(
				`data-ttl="${Number(maxAge[1]) - Number(fetched.response.headers.get('age') ?? 0)}"`
			);
	}
	return `<script ${attributes.join(' ')}>${escapeJson({ status: fetched.response.status, statusText: fetched.response.statusText, headers, body: [101, 103, 204, 205, 304].includes(fetched.response.status) ? null : fetched.response_body })}</script>`;
}
