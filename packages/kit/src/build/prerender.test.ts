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
	PageNode,
	ServerHooks,
	ServerManifest,
	ServerOptions
} from '../types/internal/server.ts';
import { encodeArgument } from '../shared/remote.ts';
import { deserialize } from '../shared/serialization.ts';
import { analyse } from './analysis.ts';
import { prerender } from './prerender.ts';
import type { PolicyReporter, PrerenderJob } from './jobs.ts';
import { loadEmulator, type Runtime } from './runtime.ts';

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
		output: { preloadStrategy: 'modulepreload', bundleStrategy: 'split', linkHeaderPreload: false },
		router: { type: 'pathname', resolution: 'client' },
		embedded: false,
		tracing: { server: false },
		dev: false,
		building: true,
		prerendering: true,
		remote: handleRemote
	};
	const server = new Server(manifest, options);
	await server.init({ env: {} });
	return { server, manifest, options, environment: server.environment, read: () => null };
}
async function job(runtime: Runtime, name: string): Promise<PrerenderJob> {
	return {
		kind: 'prerender',
		root: directory,
		mode: 'production',
		directory: path.join(directory, name),
		assets: directory,
		origin: 'https://app.test',
		environment: {},
		analysis: await analyse(runtime.manifest, false),
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
	const result = await prerender(input, runtime, fail);
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
	const result = await prerender(input, runtime, fail);
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

test('an input generator failure rejects prerendering without turning it into an HTTP policy issue', async () => {
	const failure = new Error('input generation failed');
	const read = remotePrerender('unchecked', (value) => value, {
		inputs: async () => {
			throw failure;
		}
	});
	const runtime = await app({ functions: { read } });
	await expect(prerender(await job(runtime, 'generator-error'), runtime, fail)).rejects.toBe(
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
			prerender(input, runtime, async (issue) => {
				expect(issue).toMatchObject({
					kind: 'handleHttpError',
					details: { status: 500, path: kind === 'prerender' ? '/_app/remote/hash/read' : '/a' }
				});
				throw new Error('prerender rejected');
			})
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
	const result = await prerender(input, runtime, fail);
	const values = [...result.prerendered.pages.values()].map(
		({ file }) =>
			readFileSync(path.join(input.directory, 'prerendered/pages', file), 'utf8').match(
				/<output>(.*?)<\/output>/
			)![1]
	);
	expect(new Set(values)).toEqual(new Set(['built1', 'built2']));
});
