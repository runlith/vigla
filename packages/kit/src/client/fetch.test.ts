import { afterEach, expect, test, vi } from 'vitest';
import { hashRequest } from '../shared/hash.ts';
import { FetchCache } from './fetch.ts';

let close: (() => void) | undefined;
afterEach(() => {
	close?.();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

test('hashed POST replays survive cache hits and a canonical global mutation evicts them', async () => {
	vi.stubGlobal('fetch', async () => new Response('live'));
	const cache = new FetchCache();
	close = cache.observe();
	const init = {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{"lang":"fr"}'
	};
	const script = document.createElement('script');
	script.type = 'application/json';
	script.setAttribute('data-sveltekit-fetched', '');
	script.setAttribute('data-url', '/api');
	script.setAttribute('data-hash', hashRequest(init.headers, init.body));
	script.setAttribute('data-ttl', '60');
	script.textContent = JSON.stringify({ body: 'cached', status: 200 });
	document.body.append(script);
	const page = new URL(location.href);
	expect(await (await cache.fetch('/api', init, page)).text()).toBe('cached');
	cache.initial = false;
	expect(await (await cache.fetch('/api', init, page)).text()).toBe('cached');
	await globalThis.fetch(new URL('/nested/../api', page), { method: 'POST' });
	expect(await (await cache.fetch('/api', init, page)).text()).toBe('live');
});

test('empty Request headers select an unhashed replay and null response bodies remain null', async () => {
	const script = document.createElement('script');
	script.type = 'application/json';
	script.setAttribute('data-sveltekit-fetched', '');
	script.setAttribute('data-url', '/empty');
	script.textContent = JSON.stringify({ body: null, status: 204 });
	document.body.append(script);
	const response = await new FetchCache().fetch(
		new Request(new URL('/empty', location.href)),
		undefined,
		new URL(location.href)
	);
	expect(response.status).toBe(204);
	expect(response.body).toBe(null);
});

test('a replayed response retains its TTL after delayed admission and expires after that duration', async () => {
	let time = 8000;
	vi.spyOn(performance, 'now').mockImplementation(() => time);
	vi.stubGlobal('fetch', async () => new Response('live'));
	const script = document.createElement('script');
	script.type = 'application/json';
	script.setAttribute('data-sveltekit-fetched', '');
	script.setAttribute('data-url', '/ttl');
	script.setAttribute('data-ttl', '7');
	script.textContent = JSON.stringify({ body: 'cached', status: 200 });
	document.body.append(script);
	const cache = new FetchCache();
	const page = new URL(location.href);
	expect(await (await cache.fetch('/ttl', undefined, page)).text()).toBe('cached');
	cache.initial = false;
	time = 14999;
	expect(await (await cache.fetch('/ttl', undefined, page)).text()).toBe('cached');
	time = 15000;
	expect(await (await cache.fetch('/ttl', undefined, page)).text()).toBe('live');
});
