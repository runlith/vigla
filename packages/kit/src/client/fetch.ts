import { hashRequest } from '../shared/hash.ts';
import { decodeBase64 } from './stream.ts';

interface Cached {
	body: BodyInit | null;
	init: ResponseInit;
	expires: number;
	url: string;
}

export class FetchCache {
	initial = true;
	readonly #cache = new Map<string, Cached>();

	async fetch(
		input: RequestInfo | URL,
		options: RequestInit | undefined,
		page: URL
	): Promise<Response> {
		let init = options;
		if (input instanceof Request) {
			init = {
				method: input.method,
				headers: [...input.headers].length ? input.headers : undefined,
				body:
					input.method === 'GET' || input.method === 'HEAD'
						? undefined
						: new Uint8Array(await input.clone().arrayBuffer()),
				cache: input.cache,
				credentials: input.credentials,
				integrity: input.integrity,
				keepalive: input.keepalive,
				mode: input.mode,
				redirect: input.redirect,
				referrer: input.referrer,
				referrerPolicy: input.referrerPolicy,
				signal: input.signal,
				...options
			};
		}
		const url = new URL(input instanceof Request ? input.url : input, page);
		const requested = url.origin === page.origin ? url.href.slice(url.origin.length) : url.href;
		const body = init?.body;
		const replayable = !body || typeof body === 'string' || ArrayBuffer.isView(body);
		const digest =
			replayable && (init?.headers || body)
				? hashRequest(init?.headers, body as string | ArrayBufferView | undefined)
				: '';
		const key = JSON.stringify([requested, digest]);
		const method = init?.method?.toUpperCase() ?? 'GET';
		if (method !== 'GET' && method !== 'HEAD') {
			for (const [key, cached] of this.#cache)
				if (cached.url === requested) this.#cache.delete(key);
		}
		if (this.initial && replayable) {
			const script = [
				...document.querySelectorAll<HTMLScriptElement>('script[data-sveltekit-fetched]')
			].find(
				(script) =>
					script.getAttribute('data-url') === requested &&
					(script.getAttribute('data-hash') ?? '') === digest
			);
			if (script?.textContent) {
				const {
					body: text,
					...response
				}: { body: string; status: number; statusText?: string; headers?: Record<string, string> } =
					JSON.parse(script.textContent);
				script.remove();
				const value = script.hasAttribute('data-b64') ? decodeBase64(text) : text;
				const ttl = Number(script.getAttribute('data-ttl'));
				if (ttl > 0)
					this.#cache.set(key, {
						url: requested,
						body: value,
						init: response,
						expires: ttl * 1000
					});
				return new Response(value, response);
			}
		}
		const cached = replayable && this.#cache.get(key);
		if (cached) {
			if (
				performance.now() < cached.expires &&
				(!init?.cache || ['default', 'force-cache', 'only-if-cached'].includes(init.cache))
			) {
				return new Response(cached.body, cached.init);
			}
			this.#cache.delete(key);
		}
		return fetch(url, init);
	}
}
