import { AsyncLocalStorage } from 'node:async_hooks';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { getOwner } from 'vigla';
import type { Component } from 'vigla/server';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { RemoteData, RemoteExport, RemoteResponse } from '../../types/internal/remote.ts';
import type {
	RequestStore,
	RootProps,
	ServerHooks,
	ServerManifest,
	ServerOptions
} from '../../types/internal/server.ts';
import type { PageNode } from '../../types/internal/server.ts';
import {
	command,
	form,
	getRequestEvent,
	getRequestOwner,
	prerender,
	query,
	requested
} from '../../entries/app/server/server.ts';
import { Server, handleRemote, initRemote } from '../../entries/internal/server.ts';
import { redirect } from '../../entries/index.ts';
import { HttpError, Redirect, ValidationError } from '../../shared/outcomes.ts';
import { deserialize } from '../../shared/serialization.ts';
import { encodeArgument, getRemoteKey } from '../../shared/remote.ts';

interface Fixture {
	exports: Record<string, unknown>;
	hooks?: ServerHooks;
	load?: NonNullable<PageNode['server']>['load'];
	render?: Component<RootProps>;
}

async function app(fixture: Fixture): Promise<Server> {
	for (const [name, value] of Object.entries(fixture.exports)) initRemote(value, `hash/${name}`);
	const manifest: ServerManifest = {
		app_dir: '_app',
		app_path: '_app',
		assets: new Set(),
		mime_types: {},
		client: null,
		remotes: { hash: async () => ({ default: fixture.exports as Record<string, RemoteExport> }) },
		server_assets: {},
		prerendered_routes: new Set(),
		matchers: async () => ({}),
		routes: [
			{
				id: '/page',
				pattern: /^\/page\/?$/,
				params: [],
				page: { layouts: [], errors: [], leaf: 0 },
				endpoint: null
			}
		],
		nodes: [
			async () => ({
				index: 0,
				imports: [],
				stylesheets: [],
				fonts: [],
				component: async () => () => {},
				server: { load: fixture.load }
			})
		]
	};
	const options: ServerOptions = {
		global: '__remote_test',
		root: fixture.render ?? (() => {}),
		getHooks: async () => fixture.hooks ?? {},
		templates: {
			app: ({ head, body }) => `<head>${head}</head><body>${body}</body>`,
			error: ({ status, message }) => `${status}:${message}`
		},
		appTemplateContainsNonce: false,
		csp: {},
		csrf: { checkOrigin: true, trustedOrigins: [] },
		paths: { base: '', assets: '', relative: false },
		env: { set: () => ({ public: {}, private: {}, rendered: {} }) },
		serviceWorker: null,
		version: { name: 'remote', pollInterval: 0 },
		output: { preloadStrategy: 'modulepreload', bundleStrategy: 'split', linkHeaderPreload: false },
		router: { type: 'pathname', resolution: 'client' },
		embedded: false,
		tracing: { server: false },
		dev: true,
		building: false,
		prerendering: false,
		remote: handleRemote
	};
	const server = new Server(manifest, options);
	await server.init({ env: {}, scope: new AsyncLocalStorage<RequestStore>() });
	return server;
}
const address = { getClientAddress: () => '192.0.2.1' };
const request = (path: string, init?: RequestInit) => new Request(`https://app.test${path}`, init);
async function call(
	server: Server,
	name: string,
	input?: unknown,
	refreshes?: string[]
): Promise<RemoteData> {
	const response = await server.respond(
		request(`/_app/remote/hash/${name}`, {
			method: 'POST',
			headers: { origin: 'https://app.test', 'content-type': 'application/json' },
			body: JSON.stringify({ payload: encodeArgument(input), refreshes })
		}),
		address
	);
	const body = (await response.json()) as RemoteResponse;
	expect(body.type).toBe('result');
	return deserialize(body.type === 'result' ? body.data! : '');
}

test('request caching and owner hydration preserve transported query values from server loads', async () => {
	class Value {
		readonly n: number;
		constructor(n: number) {
			this.n = n;
		}
	}
	let reads = 0;
	const read = query(() => {
		expect(getOwner()).toBe(getRequestOwner());
		return new Value(++reads);
	});
	const transport = {
		Value: {
			encode: (value: unknown) => value instanceof Value && value.n,
			decode: (n: number) => new Value(n)
		}
	};
	const server = await app({
		exports: { read },
		hooks: { transport },
		load: async () => {
			const value = read();
			const [a, b] = await Promise.all([value, read()]);
			expect(a).toBe(b);
			value.set(new Value(9));
			expect((await value).n).toBe(9);
			await value.refresh();
			return { n: (await value).n };
		},
		render: (out, props) => out.push(String(props.tree.data.n))
	});
	const response = await server.respond(request('/page'), address);
	const html = await response.text();
	expect(reads).toBe(2);
	const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!;
	const window: Record<string, any> = {};
	runInNewContext(script, { window });
	const encoded = await window.__vigla.h.get('hash/read/');
	expect(deserialize(encoded, transport)).toEqual({ v: new Value(2) });
	await (await server.respond(request('/page'), address)).text();
	expect(reads).toBe(4);
});

test('explicit query seeds reach SSR hydration when only their parent is awaited', async () => {
	const child = query('unchecked', (id: string) => id);
	const parent = query(() => {
		child('1').set('one');
		return ['1'];
	});
	const server = await app({
		exports: { child, parent },
		load: async () => ({ ids: await parent() }),
		render: (out, props) => out.push(props.tree.data.ids.join(','))
	});
	const html = await (await server.respond(request('/page'), address)).text();
	const window: Record<string, any> = {};
	runInNewContext(/<script[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!, { window });
	const nodes = Object.fromEntries(
		[...window.__vigla.h].map(([key, value]) => [key, deserialize(value)])
	);
	expect(nodes).toEqual({
		'hash/parent/': { v: ['1'] },
		[getRemoteKey('hash/child', encodeArgument('1'))]: { v: 'one' }
	});
});

test('requested refreshes preserve raw cache keys and run after the command mutates state', async () => {
	let count = 1;
	const schema: StandardSchemaV1<string, number> = {
		'~standard': {
			version: 1,
			vendor: 'contract',
			validate: (input) => ({ value: Number(input) })
		}
	};
	const read = query(schema, (n) => count + n);
	const mutate = command('unchecked', (next: number) => {
		for (const entry of requested(read, 2)) {
			expect(entry.arg).toBe(2);
			void entry.query.refresh();
		}
		count = next;
		return count;
	});
	const server = await app({ exports: { read, mutate } });
	const key = getRemoteKey('hash/read', encodeArgument('02'));
	const body = await call(server, 'mutate', 5, [key]);
	expect(body).toEqual({ _: 5, r: true, q: { [key]: { v: 7 } } });
});

test('validation failures reach the error hook and redirects retain their remote result envelope', async () => {
	let validations = 0;
	const issues = [{ message: 'invalid input' }];
	const schema: StandardSchemaV1 = {
		'~standard': { version: 1, vendor: 'contract', validate: () => ({ issues }) }
	};
	const read = query(schema, () => 1);
	const move = command(() => {
		throw new Redirect(303, '/next');
	});
	const server = await app({
		exports: { read, move },
		hooks: {
			handleError: (caught) => {
				expect(caught.kind).toBe('validation');
				validations++;
				return { status: 422, message: 'invalid' };
			}
		}
	});
	const response = await server.respond(
		request(`/_app/remote/hash/read?payload=${encodeArgument('bad')}`),
		address
	);
	expect(await response.json()).toEqual({
		type: 'error',
		error: { status: 422, message: 'invalid' }
	});
	expect(validations).toBe(1);
	expect(await call(server, 'move')).toEqual({ redirect: '/next' });
});

test('batch queries retain public redirect envelopes without exposing their event URL', async () => {
	const move = query.batch('unchecked', async ([location]: string[]) => {
		await Promise.resolve();
		expect(() => getRequestEvent().url).toThrow('Cannot access `event.url` in a query');
		redirect(307, location!);
	});
	const server = await app({ exports: { move } });
	for (const location of ['/next', 'https://app.test/next']) {
		const response = await server.respond(
			request('/_app/remote/hash/move', {
				method: 'POST',
				headers: { origin: 'https://app.test', 'content-type': 'application/json' },
				body: JSON.stringify({ payloads: [encodeArgument(location)] })
			}),
			address
		);
		const body = (await response.json()) as RemoteResponse;
		expect(response.status).toBe(200);
		expect(body.type).toBe('result');
		expect(deserialize(body.type === 'result' ? body.data! : '')).toEqual({ redirect: location });
	}
});

test('native keyed forms render their own result and redact rejected sensitive input per request', async () => {
	const save = form('unchecked', (input: { id: string; name: string; _secret: string }, issue) => {
		if (!input.name) throw new ValidationError([issue.name('required')]);
		return `${input.id}:${input.name}`;
	});
	const server = await app({
		exports: { save },
		render: (out) => {
			const current = save.for('a/b');
			current.fields.name.set('preset');
			out.push(
				`<output>${current.result ?? ''}|${current.fields.name.value() ?? ''}|${current.fields._secret.value() ?? ''}</output>`
			);
		}
	});
	const post = async (name: string) =>
		server.respond(
			request('/page?/remote=hash/save/%22a%2Fb%22', {
				method: 'POST',
				headers: { origin: 'https://app.test', accept: 'text/html' },
				body: new URLSearchParams({
					'name/hash/save': name,
					'_secret/hash/save': 'private'
				})
			}),
			address
		);
	expect(await (await post('value')).text()).toContain('<output>a/b:value||</output>');
	const invalid = await (await post('')).text();
	expect(invalid).toContain('<output>||</output>');
	expect(invalid).not.toContain('private');
	const initial = await (await server.respond(request('/page'), address)).text();
	expect(initial).toContain('<output>|preset|</output>');
	const window: Record<string, any> = {};
	runInNewContext(/<script[^>]*>([\s\S]*?)<\/script>/.exec(initial)![1]!, { window });
	const seed = window.__vigla.h.get('hash/save/"a/b"');
	expect(typeof seed).toBe('string');
	expect(deserialize(seed)).toEqual({ v: { input: { name: 'preset' } } });
});

test('batch queries coalesce server reads and return per-item remote failures', async () => {
	const read = query.batch('unchecked', (_inputs: number[]) => (input: number, index) => {
		if (input < 0) throw new HttpError({ status: 404, message: 'missing' });
		return input * 2 + index;
	});
	const server = await app({
		exports: { read },
		load: async () => {
			const value = read(2);
			const first = value.then((n) => n);
			const second = read(3).then((n) => n);
			await Promise.resolve();
			await value.refresh();
			return { values: await Promise.all([first, second, read(2)]) };
		},
		render: (out, props) => out.push(JSON.stringify(props.tree.data.values))
	});
	expect(await (await server.respond(request('/page'), address)).text()).toContain('[4,7,4]');
	const response = await server.respond(
		request('/_app/remote/hash/read', {
			method: 'POST',
			headers: { origin: 'https://app.test', 'content-type': 'application/json' },
			body: JSON.stringify({ payloads: [encodeArgument(2), encodeArgument(-1)] })
		}),
		address
	);
	const body = (await response.json()) as RemoteResponse;
	expect(body.type).toBe('result');
	expect(deserialize(body.type === 'result' ? body.data! : '')._).toEqual([
		{ type: 'result', data: 4 },
		{ type: 'error', error: { status: 404, message: 'missing' } }
	]);
});

test('prerender calls share crawl values and write the upstream result dependency', async () => {
	let reads = 0;
	const read = prerender(
		'unchecked',
		(n: number) => {
			reads++;
			return n * 3;
		},
		{ inputs: () => [2] }
	);
	const server = await app({ exports: { read } });
	const prerendering = {
		fallback: false,
		insideReroute: false,
		dependencies: new Map(),
		remoteResponses: new Map()
	};
	const path = `/_app/remote/hash/read/${encodeArgument(2)}`;
	for (let i = 0; i < 2; i++) {
		const response = await server.respond(request(path), { ...address, prerendering });
		expect(response.headers.has('cache-control')).toBe(false);
		const body = (await response.json()) as RemoteResponse;
		expect(deserialize(body.type === 'result' ? body.data! : '')._).toBe(6);
	}
	expect(reads).toBe(1);
	expect(JSON.parse(prerendering.dependencies.get(path).body)).toEqual({
		type: 'result',
		data: '[{"_":1},6]'
	});
});

test('loading queries do not delay SSR or publish an unresolved hydration value', async () => {
	const read = query(() => new Promise<never>(() => {}));
	const server = await app({
		exports: { read },
		render: (out) => out.push(`<output>${read().loading}</output>`)
	});
	const html = await (await server.respond(request('/page'), address)).text();
	expect(html).toContain('<output>true</output>');
	expect(html).not.toContain('hash/read/');
});

test('server live consumers retain only the latest undrained value and replay terminal errors', async () => {
	let produced!: () => void;
	const complete = new Promise<void>((resolve) => {
		produced = resolve;
	});
	const read = query.live(function* () {
		yield 1;
		yield 2;
		yield 3;
		produced();
	});
	const failure = new Error('source failed');
	const failed = query.live(function* () {
		yield 1;
		throw failure;
	});
	const server = await app({
		exports: { read, failed },
		load: async () => {
			const stream = read()[Symbol.asyncIterator]();
			const first = await stream.next();
			await complete;
			const latest = await stream.next();
			const errors = failed()[Symbol.asyncIterator]();
			expect((await errors.next()).value).toBe(1);
			await expect(errors.next()).rejects.toBe(failure);
			await expect(failed()[Symbol.asyncIterator]().next()).rejects.toBe(failure);
			return { values: [first.value, latest.value] };
		},
		render: (out, props) => out.push(JSON.stringify(props.tree.data.values))
	});
	expect(await (await server.respond(request('/page'), address)).text()).toContain('[1,3]');
});

test('live query streams use upstream SSE frames, deduplicate values and clean up on cancellation', async () => {
	let cleanup!: () => void;
	const closed = new Promise<void>((resolve) => {
		cleanup = resolve;
	});
	const read = query.live(async function* () {
		const signal = getRequestEvent().request.signal;
		try {
			yield 1;
			yield 1;
			yield 2;
			await new Promise<void>((resolve) =>
				signal.addEventListener('abort', () => resolve(), { once: true })
			);
		} finally {
			cleanup();
		}
	});
	const server = await app({ exports: { read } });
	const response = await server.respond(request('/_app/remote/hash/read'), address);
	expect(response.headers.get('content-type')).toBe('text/event-stream');
	const reader = response.body!.getReader();
	const decoder = new TextDecoder();
	expect(decoder.decode((await reader.read()).value)).toBe(
		'data: {"type":"result","result":"[1]"}\n\n'
	);
	expect(decoder.decode((await reader.read()).value)).toBe(
		'data: {"type":"result","result":"[2]"}\n\n'
	);
	await reader.cancel();
	await closed;
});
