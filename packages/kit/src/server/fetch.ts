import { parseSetCookie } from 'cookie';
import type { SerializeOptions } from 'cookie';
import type { RequestStore } from '../types/internal/server.ts';
import type { Server } from './index.ts';
import type { CookieJar } from './cookies.ts';
import { runRequest } from './scope.ts';
import { appEvent } from './hooks.ts';

function requestInput(input: RequestInfo | URL, init: RequestInit | undefined, base: URL): Request {
	return input instanceof Request
		? init
			? new Request(input, init)
			: input
		: new Request(new URL(input, base), init);
}

export function createFetch(server: Server, store: RequestStore, cookies: CookieJar): typeof fetch {
	const { event } = store;
	const internal: typeof fetch = async (input, init) => {
		const request = requestInput(input, init, event.url);
		const url = new URL(request.url);
		const mode = (input instanceof Request ? input.mode : init?.mode) ?? 'cors';
		const credentials =
			(input instanceof Request ? input.credentials : init?.credentials) ?? 'same-origin';
		if (!request.headers.has('origin')) request.headers.set('origin', event.url.origin);
		if (
			['GET', 'HEAD'].includes(request.method) &&
			(url.origin === event.url.origin || mode === 'no-cors')
		)
			request.headers.delete('origin');
		let decoded: string;
		try {
			decoded = decodeURIComponent(url.pathname);
		} catch {
			return globalThis.fetch(request);
		}
		const base = server.options.paths.base;
		const sameApp =
			url.origin === event.url.origin &&
			(!base || decoded === base || decoded.startsWith(`${base}/`));
		if (!sameApp) {
			if (`.${url.hostname}`.endsWith(`.${event.url.hostname}`) && credentials !== 'omit') {
				const header = cookies.header(url, request.headers.get('cookie'));
				if (header) request.headers.set('cookie', header);
			}
			return globalThis.fetch(request);
		}
		const assetPrefix = server.options.paths.assets || base;
		const filename = (
			decoded.startsWith(`${assetPrefix}/`) ? decoded.slice(assetPrefix.length) : decoded
		).slice(1);
		const asset =
			server.manifest.assets.has(filename) || filename in server.manifest.server_assets
				? filename
				: server.manifest.assets.has(`${filename}/index.html`)
					? `${filename}/index.html`
					: null;
		if (asset) {
			if (store.state.read) {
				const body = await store.state.read(asset);
				const type = server.manifest.mime_types[asset.slice(asset.lastIndexOf('.'))];
				return new Response(body, { headers: type ? { 'content-type': type } : {} });
			}
			return globalThis.fetch(request, { redirect: 'manual' });
		}
		if (
			server.manifest.prerendered_routes.has(decoded) ||
			server.manifest.prerendered_routes.has(decoded.replace(/\/$/, ''))
		)
			return globalThis.fetch(request, { redirect: 'manual' });
		if (credentials !== 'omit') {
			const header = cookies.header(url, request.headers.get('cookie'));
			if (header) request.headers.set('cookie', header);
			const auth = event.request.headers.get('authorization');
			if (auth && !request.headers.has('authorization')) request.headers.set('authorization', auth);
		}
		if (!request.headers.has('accept')) request.headers.set('accept', '*/*');
		const language = event.request.headers.get('accept-language');
		if (language && !request.headers.has('accept-language'))
			request.headers.set('accept-language', language);
		if (request.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
		let onAbort: () => void;
		const aborted = new Promise<never>((_, reject) => {
			onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
			request.signal.addEventListener('abort', onAbort, { once: true });
		});
		const response = await Promise.race([server.respondInternal(request, store), aborted]).finally(
			() => {
				request.signal.removeEventListener('abort', onAbort);
			}
		);
		for (const value of response.headers.getSetCookie()) {
			const {
				name,
				value: content,
				...attributes
			} = parseSetCookie(value, { decode: (value) => value });
			cookies.set(name, content ?? '', {
				path: attributes.path ?? (url.pathname.split('/').slice(0, -1).join('/') || '/'),
				encode: (value) => value,
				...attributes
			} as SerializeOptions);
		}
		return response;
	};
	const execute: typeof fetch = async (input, init) => {
		const request = requestInput(input, init, event.url);
		return runRequest(store, () =>
			server.hooks.handleFetch
				? server.hooks.handleFetch({ event: appEvent(event), request, fetch: internal })
				: internal(request)
		);
	};
	return (input, init) => {
		const promise = execute(input, init);
		promise.catch(() => {});
		return promise;
	};
}
