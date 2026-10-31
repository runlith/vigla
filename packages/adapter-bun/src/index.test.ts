import { expect, test } from 'bun:test';
import { once } from 'node:events';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import type { Builder } from '@vigla/kit';
import adapter from './index.ts';

function fixture(root: string): Builder {
	const write = (directory: string, files: Record<string, string>) => {
		for (const [file, text] of Object.entries(files)) {
			mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
			writeFileSync(path.join(directory, file), text);
		}
		return Object.keys(files);
	};
	const log = Object.assign(() => {}, {
		error() {},
		warn() {},
		info() {},
		minor() {},
		success() {},
		err() {},
		prettyError() {}
	});
	return {
		log,
		config: {
			paths: { base: '/base', origin: '' },
			appDir: '_app'
		} as unknown as Builder['config'],
		routes: [],
		manifest: {} as Builder['manifest'],
		mimeTypes: { '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript' },
		prerendered: {
			pages: new Map([['/base/page/', { file: 'page/index.html' }]]),
			assets: new Map(),
			redirects: new Map([['/base/move', { status: 307, location: '/base/page/' }]]),
			paths: ['/base/page/', '/base/move']
		},
		rimraf: (directory) => rmSync(directory, { recursive: true, force: true }),
		mkdirp: (directory) => {
			mkdirSync(directory, { recursive: true });
		},
		getBuildDirectory: (name) => path.join(root, name),
		getServerDirectory: () => root + '/source',
		getClientDirectory: () => root + '/source',
		getAppPath: () => 'base/_app',
		findServerAssets: () => ['file.txt'],
		writeClient: (directory) =>
			write(directory, {
				'file.txt': '0123456789',
				'_app/immutable/chunk.js': 'export {}',
				'a+b.txt': 'plus',
				'café.txt': 'unicode',
				'index.html': 'index',
				'document.html': 'document',
				'.secret': 'private'
			}),
		writePrerendered: (directory) =>
			write(directory, { 'page/index.html': 'prerendered', 'data.txt': 'data' }),
		writeServer: (directory) => {
			mkdirSync(directory, { recursive: true });
			return [];
		},
		generateServerInstance(destination) {
			writeFileSync(
				destination,
				`let scope; let read; export const server = { async init(options) { scope = options.scope; read = options.read; }, async respond(request, options) { const url = new URL(request.url); if (url.pathname.endsWith('/read')) return new Response(read('file.txt')); if (url.pathname.endsWith('/events')) return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: message\\n\\n')); } }), { headers: { 'content-type': 'text/event-stream' } }); return scope.run(url.search, async () => { await Promise.resolve(); return Response.json({ url: request.url, address: options.getClientAddress(), scope: scope.getStore() }); }); } };`
			);
		},
		copy: () => [],
		generateEnvModule() {},
		generateFallback: async () => {},
		hasServerInstrumentationFile: () => false,
		createInstrumentationInitializer: () => '',
		instrument() {},
		async compress(directory) {
			const entries = readdirSync(directory, { recursive: true, withFileTypes: true }).filter(
				(entry) => entry.isFile()
			);
			for (const entry of entries) {
				const file = path.join(entry.parentPath, entry.name);
				writeFileSync(file + '.br', brotliCompressSync(readFileSync(file)));
				writeFileSync(file + '.gz', gzipSync(readFileSync(file)));
			}
			return entries.map((entry) =>
				path.relative(directory, path.join(entry.parentPath, entry.name))
			);
		}
	};
}

test('Bun output serves static routes, public origins, request scope and readable assets', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-bun-'));
	const out = root + '/build';
	process.env.BUN_TEST_PROTOCOL_HEADER = 'x-proto';
	process.env.BUN_TEST_HOST_HEADER = 'x-host';
	process.env.BUN_TEST_PORT_HEADER = 'x-port';
	process.env.BUN_TEST_ADDRESS_HEADER = 'x-forwarded-for';
	process.env.BUN_TEST_XFF_DEPTH = '2';
	try {
		await adapter({ out, precompress: true, envPrefix: 'BUN_TEST_' }).adapt(fixture(root));
		const { app } = await import(pathToFileURL(out + '/handler.js').href);
		const server = Bun.serve({
			hostname: '127.0.0.1',
			port: 0,
			fetch: app.fetch,
			routes: app.routes
		});
		const get = (url: string, headers: Record<string, string> = {}) =>
			fetch(new URL(url, server.url), {
				headers: { 'accept-encoding': 'identity', ...headers },
				redirect: 'manual'
			});
		try {
			const initial = await get('/base/file.txt');
			expect(await initial.text()).toBe('0123456789');
			expect(initial.headers.get('content-type')).toBe('text/plain;charset=utf-8');
			const cached = await get('/base/file.txt', {
				'if-none-match': `W/${initial.headers.get('etag')}`
			});
			expect(cached.status).toBe(304);
			const dated = await get('/base/file.txt', {
				'if-modified-since': initial.headers.get('last-modified')!
			});
			expect(dated.status).toBe(304);
			const compressed = await get('/base/file.txt', { 'accept-encoding': 'gzip' });
			expect(compressed.headers.get('content-encoding')).toBe('gzip');
			expect(compressed.headers.get('etag')).not.toBe(initial.headers.get('etag'));
			expect(await compressed.text()).toBe('0123456789');
			const range = await get('/base/file.txt', { range: 'bytes=0-0', 'accept-encoding': 'br' });
			expect(range.status).toBe(206);
			expect(range.headers.get('content-encoding')).toBeNull();
			expect(await range.text()).toBe('0');
			expect((await get('/base/_app/immutable/chunk.js')).headers.get('cache-control')).toBe(
				'public,max-age=31536000,immutable'
			);
			expect(await (await get('/base/')).text()).toBe('index');
			expect(await (await get('/base/document')).text()).toBe('document');
			expect(await (await get('/base/a+b.txt')).text()).toBe('plus');
			expect(await (await get('/base/a%2Bb.txt')).text()).toBe('plus');
			expect(await (await get('/base/caf%C3%A9.txt')).text()).toBe('unicode');
			expect(await (await get('/base/page/')).text()).toBe('prerendered');
			expect((await get('/base/page?keep=1')).headers.get('location')).toBe('/base/page/?keep=1');
			expect((await get('/base/move')).status).toBe(307);
			const dynamic = await get('/base/dynamic?scope=one', {
				'x-proto': 'http',
				'x-host': 'public.example',
				'x-port': '8080',
				'x-forwarded-for': 'first, last'
			});
			expect(await dynamic.json()).toEqual({
				url: 'http://public.example:8080/base/dynamic?scope=one',
				address: 'first',
				scope: '?scope=one'
			});
			expect(await (await get('/base/read')).text()).toBe('0123456789');
			expect((await get('/base/events')).headers.get('x-accel-buffering')).toBe('no');
			expect((await get('/base/dynamic', { 'x-proto': 'http://evil' })).status).toBe(400);
			const env = app.env;
			expect(env.integer('SHUTDOWN_TIMEOUT', 30)).toBe(30);
			process.env.BUN_TEST_SHUTDOWN_TIMEOUT = '0';
			expect(env.integer('SHUTDOWN_TIMEOUT')).toBe(0);
			for (const value of ['-1', '+1', '1.5', '', '9007199254740992']) {
				process.env.BUN_TEST_SHUTDOWN_TIMEOUT = value;
				expect(() => env.integer('SHUTDOWN_TIMEOUT')).toThrow();
			}
			for (const value of ['true', '1', 'yes', 'on']) {
				process.env.BUN_TEST_DEVELOPMENT = value;
				expect(env.boolean('DEVELOPMENT')).toBe(true);
			}
			for (const value of ['false', '0', 'no', 'off']) {
				process.env.BUN_TEST_DEVELOPMENT = value;
				expect(env.boolean('DEVELOPMENT')).toBe(false);
			}
			process.env.BUN_TEST_DEVELOPMENT = 'sometimes';
			expect(() => env.boolean('DEVELOPMENT')).toThrow();
			for (const [value, bytes] of [
				['.5K', 512],
				['1.5M', 1572864],
				['2g', 2147483648],
				['Infinity', Infinity]
			] as const) {
				process.env.BUN_TEST_BODY_SIZE_LIMIT = value;
				expect(env.bytes('BODY_SIZE_LIMIT', 1)).toBe(bytes);
			}
			for (const value of ['', '1KB', '1T', '-1', '0.1', '9007199254740992']) {
				process.env.BUN_TEST_BODY_SIZE_LIMIT = value;
				expect(() => env.bytes('BODY_SIZE_LIMIT', 1)).toThrow();
			}
		} finally {
			await server.stop(true);
		}
	} finally {
		for (const key of Object.keys(process.env))
			if (key.startsWith('BUN_TEST_')) delete process.env[key];
		rmSync(root, { recursive: true, force: true });
	}
}, 30000);

test('the compile option emits an executable-only deployment', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-bun-compile-'));
	try {
		await adapter({
			out: root + '/build',
			buildOptions: { compile: { outfile: 'application' }, minify: true }
		}).adapt(fixture(root));
		expect(statSync(root + '/build/application').mode & 0o111).not.toBe(0);
		expect(readdirSync(root + '/build').filter((file) => !file.endsWith('.map'))).toEqual([
			'application'
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 30000);

test('adapt rejects missing server-readable assets and reserved Bun route spellings', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-bun-invalid-'));
	try {
		const builder = fixture(root);
		builder.findServerAssets = () => ['absent.txt'];
		await expect(adapter({ out: root + '/build' }).adapt(builder)).rejects.toThrow(
			'Could not find server asset'
		);
		builder.prerendered.pages.set('/base/:parameter', { file: 'page/index.html' });
		await expect(adapter({ out: root + '/build' }).adapt(builder)).rejects.toThrow(
			'Unsupported literal Bun route path'
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('the shipped Bun listener applies environment precedence and stops an event stream at its deadline', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-bun-listen-'));
	process.env.BUN_LIFETIME_HOST = '127.0.0.1';
	process.env.BUN_LIFETIME_PORT = '0';
	process.env.BUN_LIFETIME_SHUTDOWN_TIMEOUT = '0';
	process.env.BUN_LIFETIME_CONNECTION_IDLE_TIMEOUT = '1';
	let server: Bun.Server<undefined> | undefined;
	try {
		await adapter({
			out: root + '/build',
			envPrefix: 'BUN_LIFETIME_',
			serverOptions: { hostname: 'invalid.example', port: 9 }
		}).adapt(fixture(root));
		({ server } = await import(pathToFileURL(root + '/build/index.js').href));
		expect(server!.hostname).toBe('127.0.0.1');
		expect(server!.port).not.toBe(9);
		const response = await fetch(new URL('/events', server!.url));
		expect(response.headers.get('x-accel-buffering')).toBe('no');
		const reader = response.body!.getReader();
		await reader.read();
		const stopped = once(process, 'sveltekit:shutdown');
		process.emit('SIGTERM');
		expect(await stopped).toEqual(['SIGTERM']);
		expect(server!.pendingRequests).toBe(0);
		await expect(reader.read()).rejects.toThrow();
	} finally {
		await server?.stop(true);
		for (const key of Object.keys(process.env))
			if (key.startsWith('BUN_LIFETIME_')) delete process.env[key];
		rmSync(root, { recursive: true, force: true });
	}
}, 30000);
