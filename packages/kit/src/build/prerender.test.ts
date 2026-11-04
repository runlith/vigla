import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterAll, expect, test } from 'vitest';
import { prerender as remotePrerender, query } from '../entries/app/server/server.ts';
import { Server, handleRemote, initRemote } from '../entries/internal/server.ts';
import type { RemoteExport, RemoteResponse } from '../types/internal/remote.ts';
import type {
	Endpoint,
	PageNode,
	ServerHooks,
	ServerManifest,
	ServerOptions,
	ServerRoute
} from '../types/internal/server.ts';
import { redirect } from '../entries/index.ts';
import { own } from '../shared/identity.ts';
import { resolveConfig, validateConfig } from '../config/index.ts';
import { parseRoute } from '../shared/routing/index.ts';
import { encodeArgument } from '../shared/remote.ts';
import { deserialize } from '../shared/serialization.ts';
import { analyse } from './analysis.ts';
import { createBuilder, createLogger } from './builder.ts';
import type { BuildContext } from './types.ts';
import { prerender } from './prerender.ts';
import type { PolicyReporter, PrerenderJob } from './jobs.ts';
import { loadEmulator, type Runtime } from './runtime.ts';
import { diagnostics } from '../shared/diagnostics.ts';
import { BuildMessages } from './messages.ts';

const d = diagnostics(own);
const e = new BuildMessages(d);

const directory = mkdtempSync(path.join(os.tmpdir(), 'kit-prerender-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

interface Fixture {
	functions: Record<string, unknown>;
	hooks?: ServerHooks;
	load?: NonNullable<PageNode['server']>['load'];
	base?: string;
}
async function app(fixture: Fixture): Promise<Runtime> {
	const base = fixture.base ?? '';
	for (const [name, fn] of Object.entries(fixture.functions)) initRemote(fn, `hash/${name}`);
	const manifest: ServerManifest = {
		app_dir: '_app',
		app_path: base.slice(1) + (base ? '/' : '') + '_app',
		assets: new Set(),
		mime_types: {},
		client: null,
		remotes: { hash: async () => ({ default: fixture.functions as Record<string, RemoteExport> }) },
		server_assets: {},
		prerendered_routes: new Set(),
		matchers: async () => ({}),
		routes: fixture.load
			? ['/a', '/b'].map((id) => ({
					id,
					pattern: new RegExp(`^${id}/?$`),
					params: [],
					page: { layouts: [], errors: [], leaf: 0 },
					endpoint: null
				}))
			: [],
		nodes: [
			async () => ({
				index: 0,
				imports: [],
				stylesheets: [],
				fonts: [],
				component: async () => () => {},
				server: { prerender: true, load: fixture.load }
			}),
			async () => ({
				index: 1,
				imports: [],
				stylesheets: [],
				fonts: [],
				component: async () => () => {}
			})
		]
	};
	const options: ServerOptions = {
		global: '__prerender_test',
		root: (out, props) => out.push(`<output>${props.tree.data.value}</output>`),
		getHooks: async () => fixture.hooks ?? {},
		templates: {
			app: ({ head, body }) => `<head>${head}</head><body>${body}</body>`,
			error: ({ status, message }) => `${status}:${message}`
		},
		appTemplateContainsNonce: false,
		csp: {},
		csrf: { checkOrigin: true, trustedOrigins: [] },
		paths: { base, assets: '', relative: false },
		env: { set: () => ({ public: {}, private: {}, rendered: {} }) },
		serviceWorker: null,
		version: { name: 'test', pollInterval: 0 },
		output: { bundleStrategy: 'split', linkHeaderPreload: false },
		router: { type: 'pathname', resolution: 'client' },
		embedded: false,
		tracing: { server: false },
		dev: false,
		building: true,
		prerendering: true,
		remote: handleRemote
	};
	const server = new Server(manifest, options);
	const init = () => server.init({ env: {} });
	await init();
	return { server, init, manifest, options, environment: server.environment, read: () => null };
}
async function job(runtime: Runtime, name: string): Promise<PrerenderJob> {
	return {
		kind: 'prerender',
		identity: own,
		root: directory,
		mode: 'production',
		directory: path.join(directory, name),
		assets: directory,
		origin: 'https://app.test',
		environment: {},
		analysis: await analyse(runtime.manifest, false, d),
		base: runtime.options.paths.base,
		hash: false,
		entries: ['*'],
		crawl: true,
		concurrency: 2
	};
}
const fail: PolicyReporter = async (issue) => {
	throw new Error(issue.details.message);
};

class Value {
	readonly text: string;
	constructor(text: string) {
		this.text = text;
	}
}
const transport = {
	Value: {
		encode: (value: unknown) => value instanceof Value && value.text,
		decode: (text: string) => new Value(text)
	}
};

test('remote inputs produce static data without any prerendered pages, preserving base and transport', async () => {
	const count = remotePrerender(() => 1);
	const read = remotePrerender('unchecked', (value: string | Value) => value, {
		inputs: async () => ['中文', new Value('transported')],
		dynamic: true
	});
	const runtime = await app({
		functions: { count, read },
		base: '/basepath',
		hooks: { transport }
	});
	const input = await job(runtime, 'inputs');
	const result = await prerender(input, runtime, fail, e);
	const values = [
		['hash/count', 1],
		[`hash/read/${encodeArgument('中文', transport)}`, '中文'],
		[`hash/read/${encodeArgument(new Value('transported'), transport)}`, new Value('transported')]
	] as const;
	expect(result.prerendered.pages.size).toBe(0);
	expect(result.prerendered.assets.size).toBe(values.length);
	for (const [name, value] of values) {
		const url = `/basepath/_app/remote/${name}`;
		expect(result.prerendered.assets.get(url)).toEqual({ type: 'application/json' });
		const body = JSON.parse(
			readFileSync(path.join(input.directory, 'prerendered/data/_app/remote', name), 'utf8')
		) as RemoteResponse;
		expect(body.type).toBe('result');
		expect(deserialize(body.type === 'result' ? body.data! : '', transport)._).toEqual(value);
	}
});

test('page-discovered arguments share a crawl value, static output and hydration across pages', async () => {
	let reads = 0;
	const read = remotePrerender('unchecked', (arg: string) => `${arg}:${++reads}`);
	const runtime = await app({
		functions: { read },
		load: async () => ({ value: await read('unlisted') })
	});
	const input = await job(runtime, 'discovered');
	const result = await prerender(input, runtime, fail, e);
	expect(reads).toBe(1);
	const payload = encodeArgument('unlisted');
	const remotePath = `/_app/remote/hash/read/${payload}`;
	expect(result.prerendered.paths).toContain(remotePath);
	const body = readFileSync(path.join(input.directory, 'prerendered/data', remotePath), 'utf8');
	expect(JSON.parse(body)).toEqual({
		type: 'result',
		data: '[{"_":1},"unlisted:1"]'
	});
	for (const page of ['/a', '/b']) {
		const html = readFileSync(
			path.join(input.directory, 'prerendered/pages', result.prerendered.pages.get(page)!.file),
			'utf8'
		);
		expect(html).toContain('<output>unlisted:1</output>');
		const window: Record<string, any> = {};
		runInNewContext(/<script[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!, { window });
		expect(deserialize(await window.__vigla.h.get(`hash/read/${payload}`))).toEqual({
			v: 'unlisted:1'
		});
	}
});

test('a reached page with actions rejects prerendering through its HTTP error policy', async () => {
	const runtime = await app({
		functions: {},
		load: () => ({}),
		hooks: {
			handleError({ error }) {
				expect(error).toMatchObject({
					name: 'Kit error',
					message: expect.stringContaining('prerender_actions')
				});
				return { message: String(error) };
			}
		}
	});
	const node = await runtime.manifest.nodes[0]!();
	node.server = { prerender: 'auto', actions: {} };
	runtime.manifest.nodes[0] = async () => node;
	const input = await job(runtime, 'actions');
	input.entries = ['/a'];
	const failure = new Error('prerender rejected');
	await expect(
		prerender(
			input,
			runtime,
			async (issue) => {
				expect(issue).toMatchObject({
					kind: 'handleHttpError',
					details: { status: 500, path: '/a' }
				});
				throw failure;
			},
			e
		)
	).rejects.toBe(failure);
});

test('fetched route metadata reaches Builder without promoting auto or unidentified dependencies', async () => {
	const runtime = await app({
		functions: {},
		hooks: {
			handleFetch: async ({ request, fetch }) => {
				const response = await fetch(request);
				if (new URL(request.url).pathname !== '/unidentified') return response;
				const headers = new Headers(response.headers);
				headers.delete('x-vigla-routeid');
				return new Response(response.body, { status: response.status, headers });
			}
		}
	});
	const page = await runtime.manifest.nodes[0]!();
	page.universal = {
		load: async ({ fetch }) => {
			const responses = await Promise.all([
				fetch('/implicit/value.json'),
				fetch('/auto/value.json'),
				fetch('/unidentified'),
				fetch('/asset.txt')
			]);
			await Promise.all(responses.map((response) => response.text()));
			const [implicit, auto, unidentified, asset] = responses;
			return {
				value: [
					implicit.headers.get('x-vigla-prerender'),
					auto.headers.get('x-vigla-prerender'),
					unidentified.headers.get('x-vigla-prerender'),
					unidentified.headers.get('x-vigla-routeid'),
					asset.headers.get('x-vigla-prerender'),
					asset.headers.get('x-vigla-routeid')
				]
					.map(String)
					.join(':')
			};
		}
	};
	runtime.manifest.nodes[0] = async () => page;
	runtime.manifest.nodes[1] = async () => ({
		...page,
		index: 1,
		server: { prerender: 'auto' },
		universal: undefined
	});
	const route = (id: string, endpoint: Endpoint | null, leaf?: number): ServerRoute => ({
		id,
		...parseRoute(id),
		page: leaf === undefined ? null : { layouts: [], errors: [], leaf },
		endpoint: endpoint ? async () => endpoint : null
	});
	runtime.manifest.routes = [
		route('/page', null, 0),
		route('/implicit/[value].json', { GET: () => Response.json({ answer: 42 }) }),
		route('/auto/[value].json', { GET: () => new Response('auto'), prerender: 'auto' }),
		route('/unidentified', { GET: () => new Response('unidentified') })
	];
	runtime.manifest.assets.add('asset.txt');
	runtime.manifest.mime_types['.txt'] = 'text/plain';
	writeFileSync(path.join(directory, 'asset.txt'), 'asset');
	const input = await job(runtime, 'dependency-promotion');
	const config = resolveConfig(validateConfig({ outDir: input.directory }, d), directory, d);
	input.directory = path.join(config.outDir, 'output');
	input.entries = ['/page'];
	const result = await prerender(input, runtime, fail, e);
	for (const [file, body] of [
		['implicit/value.json', '{"answer":42}'],
		['auto/value.json', 'auto'],
		['unidentified', 'unidentified'],
		['asset.txt', 'asset']
	])
		expect(
			readFileSync(path.join(input.directory, 'prerendered/dependencies', file!), 'utf8')
		).toBe(body);
	expect(
		readFileSync(
			path.join(input.directory, 'prerendered/pages', result.prerendered.pages.get('/page')!.file),
			'utf8'
		)
	).toContain('<output>true:auto:true:null:null:null</output>');
	expect(result.prerenderMap.get('/auto/[value].json')).toBe('auto');
	expect(result.prerenderMap.get('/unidentified')).toBe(false);
	expect(result.prerenderMap.has('/asset.txt')).toBe(false);
	expect(result.prerenderMap.has('/implicit/value.json')).toBe(false);
	const context: BuildContext = {
		identity: own,
		diagnostics: d,
		root: directory,
		config,
		mode: input.mode,
		tree: {
			assets: [],
			hooks: { server: null, client: null, universal: null },
			params: null,
			nodes: [0, 1].map(() => ({ depth: 0, parent: null, options: null })),
			routes: runtime.manifest.routes.map((route) => ({
				id: route.id,
				parent: null,
				segment: route.id.split('/').at(-1)!,
				pattern: route.pattern,
				params: route.params,
				layout: null,
				error: null,
				leaf: route.page?.leaf ?? null,
				page: route.page,
				endpoint: route.endpoint ? { file: 'endpoint.ts', options: null } : null
			}))
		},
		artifacts: {
			client: null,
			nodes: [],
			endpoints: {},
			matchers: null,
			remotes: {},
			chunks: {},
			serviceWorker: null
		},
		analysis: input.analysis,
		prerendered: result.prerendered,
		prerenderMap: result.prerenderMap,
		manifest: { immutable: [], assets: [], prerendered: [], routes: [] },
		environment: {},
		log: createLogger(false)
	};
	const builder = createBuilder(context);
	expect(builder.routes.find((route) => route.id === '/auto/[value].json')!.prerender).toBe('auto');
	expect(builder.routes.find((route) => route.id === '/unidentified')!.prerender).toBe(false);
	expect(result.prerenderMap.get('/implicit/[value].json')).toBe(true);
	expect(builder.routes.find((route) => route.id === '/implicit/[value].json')!.prerender).toBe(
		true
	);
});

test('reroute-fetched prerendered endpoints without entries retain their body and route identity', async () => {
	const runtime = await app({
		functions: {},
		load: () => ({ value: 'destination' }),
		hooks: {
			reroute: ({ url, fetch }) =>
				url.pathname === '/alias'
					? fetch('/api/value').then((response) => response.text())
					: undefined
		}
	});
	runtime.manifest.routes = [
		runtime.manifest.routes.find((route) => route.id === '/b')!,
		{
			id: '/api/[value]',
			pattern: /^\/api\/([^/]+?)\/?$/,
			params: [{ name: 'value', optional: false, rest: false, chained: false }],
			page: null,
			endpoint: async () => ({
				prerender: true,
				GET: () => new Response('/b', { headers: { 'content-type': 'text/plain' } })
			})
		}
	];
	const input = await job(runtime, 'reroute-endpoint');
	input.entries = ['/alias'];
	const result = await prerender(input, runtime, fail, e);
	expect(result.prerendered.assets.get('/api/value')).toEqual({ type: 'text/plain' });
	expect(
		readFileSync(path.join(input.directory, 'prerendered/dependencies/api/value'), 'utf8')
	).toBe('/b');
	expect(
		readFileSync(
			path.join(input.directory, 'prerendered/pages', result.prerendered.pages.get('/alias')!.file),
			'utf8'
		)
	).toContain('<output>destination</output>');
});

test('`*` seeds escaped static routes and redirect metadata carries the resolved location', async () => {
	const runtime = await app({
		functions: {},
		load: ({ url }) => {
			if (url.pathname === '/nested/old') redirect(307, 'next');
			return { value: url.pathname };
		}
	});
	const route = (id: string): ServerRoute => ({
		id,
		...parseRoute(id),
		page: { layouts: [], errors: [], leaf: 0 },
		endpoint: null
	});
	runtime.manifest.routes = ['/hello[x+20]world', '/nested/old', '/nested/next'].map(route);
	const input = await job(runtime, 'escaped-redirect');
	const result = await prerender(input, runtime, fail, e);
	expect(result.prerendered.pages.has('/hello world')).toBe(true);
	expect(result.prerendered.redirects.get('/nested/old')).toEqual({
		status: 307,
		location: '/nested/next'
	});
});

test("a fetched endpoint's cache-control does not replace its page's meta", async () => {
	const runtime = await app({
		functions: {},
		load: async ({ setHeaders, fetch }) => {
			setHeaders({ 'cache-control': 'no-store' });
			return { value: await (await fetch('/api')).text() };
		}
	});
	runtime.manifest.routes = [
		{ ...runtime.manifest.routes[0]! },
		{
			id: '/api',
			...parseRoute('/api'),
			page: null,
			endpoint: async () => ({
				GET: ({ setHeaders }) => {
					setHeaders({ 'cache-control': 'max-age=3600' });
					return new Response('api');
				}
			})
		}
	];
	const input = await job(runtime, 'cache-meta');
	input.entries = ['/a'];
	const result = await prerender(input, runtime, fail, e);
	const html = readFileSync(
		path.join(input.directory, 'prerendered/pages', result.prerendered.pages.get('/a')!.file),
		'utf8'
	);
	expect(html).toContain('<meta http-equiv="cache-control" content="no-store">');
	expect(html).not.toContain('max-age=3600');
});

test('an input generator failure rejects prerendering without turning it into an HTTP policy issue', async () => {
	const failure = new Error('input generation failed');
	const read = remotePrerender('unchecked', (value) => value, {
		inputs: async () => {
			throw failure;
		}
	});
	const runtime = await app({ functions: { read } });
	await expect(prerender(await job(runtime, 'generator-error'), runtime, fail, e)).rejects.toBe(
		failure
	);
});

test.each(['prerender', 'query'] as const)(
	'%s failures reject the build through its HTTP error policy',
	async (kind) => {
		const read =
			kind === 'prerender'
				? remotePrerender(() => {
						throw new Error('remote failed');
					})
				: query(() => 'not static');
		const runtime = await app({
			functions: { read },
			load: kind === 'query' ? async () => ({ value: await read() }) : undefined,
			hooks: { handleError: ({ error }) => ({ status: 500, message: String(error) }) }
		});
		const input = await job(runtime, `${kind}-error`);
		await expect(
			prerender(
				input,
				runtime,
				async (issue) => {
					expect(issue).toMatchObject({
						kind: 'handleHttpError',
						details: { status: 500, path: kind === 'prerender' ? '/_app/remote/hash/read' : '/a' }
					});
					throw new Error('prerender rejected');
				},
				e
			)
		).rejects.toThrow('prerender rejected');
	}
);

test('file-backed adapter emulation retains live platform functions during the crawl', async () => {
	interface Platform {
		value(): string;
	}
	const runtime = await app({
		functions: {},
		load: ({ platform }) => ({ value: (platform as Platform).value() })
	});
	const input = await job(runtime, 'emulator');
	expect(await loadEmulator(input)).toBeUndefined();
	const modules = path.join(directory, 'node_modules');
	mkdirSync(modules);
	symlinkSync(
		path.dirname(createRequire(import.meta.url).resolve('vite/package.json')),
		path.join(modules, 'vite'),
		'dir'
	);
	input.configFile = path.join(directory, 'vite.config.mjs');
	writeFileSync(
		input.configFile,
		`export default { plugins: [{ name: 'kit:setup', api: { options: { adapter: {
name: 'test', adapt() {}, emulate() {
let calls = 0;
return { platform({ prerender }) { return { value: () => (prerender ? 'built' : 'live') + ++calls }; } };
}
} } } }] };`
	);
	runtime.emulator = await loadEmulator(input);
	const result = await prerender(input, runtime, fail, e);
	const values = [...result.prerendered.pages.values()].map(
		({ file }) =>
			readFileSync(path.join(input.directory, 'prerendered/pages', file), 'utf8').match(
				/<output>(.*?)<\/output>/
			)![1]
	);
	expect(new Set(values)).toEqual(new Set(['built1', 'built2']));
});
