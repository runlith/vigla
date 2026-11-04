import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import type { Builder } from '@vigla/kit';
import adapter from './index.ts';

function fixture(root: string): Builder {
	const source = path.join(root, 'input');
	mkdirSync(source, { recursive: true });
	const logger = Object.assign(() => {}, {
		success() {},
		error() {},
		warn() {},
		minor() {},
		info() {},
		err() {},
		prettyError() {}
	});
	const copy = (from: string, to: string) => {
		mkdirSync(to, { recursive: true });
		cpSync(from, to, { recursive: true });
		return readdirSync(from, { recursive: true })
			.map(String)
			.filter((file) => !file.endsWith('/'));
	};
	const write = (directory: string, entries: Record<string, string>) => {
		for (const [file, text] of Object.entries(entries)) {
			mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
			writeFileSync(path.join(directory, file), text);
		}
		return Object.keys(entries);
	};
	return {
		log: logger,
		config: {
			paths: { base: '/mount', origin: '' },
			appDir: '_app'
		} as unknown as Builder['config'],
		prerendered: {
			pages: new Map([
				['/mount/about', { file: 'about.html' }],
				['/mount/always/http:example.com/', { file: 'scheme.html' }]
			]),
			assets: new Map(),
			redirects: new Map(),
			paths: ['/mount/about', '/mount/always/http:example.com/']
		},
		routes: [],
		manifest: {} as Builder['manifest'],
		identity: { name: 'vigla' } as Builder['identity'],
		mimeTypes: { '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript' },
		rimraf: (directory) => rmSync(directory, { recursive: true, force: true }),
		mkdirp: (directory) => {
			mkdirSync(directory, { recursive: true });
		},
		findServerAssets: () => [],
		generateFallback: async () => {},
		generateEnvModule() {},
		getBuildDirectory: (name) => path.join(root, name),
		getClientDirectory: () => source,
		getServerDirectory: () => source,
		getAppPath: () => 'mount/_app',
		generateServerInstance(destination) {
			writeFileSync(
				destination,
				`let scope; let read; export const server = { async init(options) { scope = options.scope; read = options.read; }, async respond(request, options) { const url = new URL(request.url); if (url.pathname.endsWith('/read')) return new Response(read('plain.txt')); if (url.pathname.endsWith('/events')) return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: message\\n\\n')); } }), { headers: { 'content-type': 'text/event-stream' } }); return scope.run(url.search, async () => { await Promise.resolve(); return Response.json({ url: request.url, address: options.getClientAddress(), scope: scope.getStore() }); }); } };`
			);
		},
		writeClient: (directory) =>
			write(directory, {
				'plain.txt': 'plain',
				'range.txt': '0123456789',
				'a+b.txt': 'plus',
				'page.html': '<h1>page</h1>',
				'sub/index.html': '<h1>sub</h1>',
				'_app/immutable/chunk.js': 'export {}',
				'_app/version.json': '{}',
				'.secret': 'secret'
			}),
		writePrerendered: (directory) =>
			write(directory, { 'about.html': '<h1>about</h1>', 'scheme.html': 'scheme' }),
		writeServer: (directory) => {
			mkdirSync(directory, { recursive: true });
			return [];
		},
		copy,
		hasServerInstrumentationFile: () => false,
		createInstrumentationInitializer: () => '',
		instrument() {},
		async compress(directory) {
			const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter(
				(entry) => entry.isFile()
			);
			for (const entry of files) {
				const file = path.join(entry.parentPath, entry.name);
				const content = readFileSync(file);
				writeFileSync(file + '.br', brotliCompressSync(content));
				writeFileSync(file + '.gz', gzipSync(content));
			}
			return files.map((entry) =>
				path.relative(directory, path.join(entry.parentPath, entry.name))
			);
		}
	};
}

function request(
	origin: string,
	pathname: string,
	headers: Record<string, string> = {},
	method = 'GET'
) {
	return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>(
		(resolve, reject) => {
			const req = http.request(origin + pathname, { method, headers }, (response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('end', () =>
					resolve({
						status: response.statusCode!,
						headers: response.headers,
						body: Buffer.concat(chunks)
					})
				);
			});
			req.on('error', reject);
			req.end();
		}
	);
}

test('the generated handler serves built representations and delegates Web requests with request scope', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-node-'));
	const out = path.join(root, 'build');
	await adapter({ out, envPrefix: 'DEPLOY_' }).adapt(fixture(root));
	process.env.DEPLOY_PROTOCOL_HEADER = 'x-proto';
	process.env.DEPLOY_HOST_HEADER = 'x-host';
	process.env.DEPLOY_PORT_HEADER = 'x-port';
	process.env.DEPLOY_ADDRESS_HEADER = 'x-forwarded-for';
	process.env.DEPLOY_XFF_DEPTH = '2';
	const { handler } = await import(pathToFileURL(path.join(out, 'handler.js')).href);
	const server = http.createServer((req, res) => {
		void handler(req, res);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert(address && typeof address === 'object');
	const origin = `http://127.0.0.1:${address.port}`;
	try {
		const plain = await request(origin, '/mount/pl%61in.txt');
		assert.equal(plain.body.toString(), 'plain');
		assert.equal(plain.headers['content-type'], 'text/plain');
		assert.equal(plain.headers['content-length'], '5');
		assert.equal((await request(origin, '/mount/plain.txt', {}, 'HEAD')).body.length, 0);
		assert.equal((await request(origin, '/mount/page')).body.toString(), '<h1>page</h1>');
		assert.equal((await request(origin, '/mount/sub/')).body.toString(), '<h1>sub</h1>');
		assert.equal(
			(await request(origin, '/mount/_app/immutable/chunk.js')).headers['cache-control'],
			'public,max-age=31536000,immutable'
		);
		assert.equal(
			(await request(origin, '/mount/_app/version.json')).headers['cache-control'],
			undefined
		);
		const encoded = await request(origin, '/mount/range.txt', {
			'accept-encoding': 'gzip;q=1, br;q=0.5'
		});
		assert.equal(encoded.headers['content-encoding'], 'gzip');
		assert.equal(encoded.headers.vary, 'Accept-Encoding');
		const cached = await request(origin, '/mount/range.txt', {
			'accept-encoding': 'gzip',
			'if-none-match': `W/${encoded.headers.etag}`
		});
		assert.equal(cached.status, 304);
		assert.equal(cached.headers.etag, encoded.headers.etag);
		const partial = await request(origin, '/mount/range.txt', { range: 'bytes=-3' });
		assert.equal(partial.status, 206);
		assert.equal(partial.body.toString(), '789');
		assert.equal((await request(origin, '/mount/range.txt', { range: 'bytes=10-' })).status, 416);
		assert.equal(
			(await request(origin, '/mount/range.txt', { range: 'bytes=0-0', 'if-range': '"stale"' }))
				.status,
			200
		);
		assert.equal((await request(origin, '/mount/about')).body.toString(), '<h1>about</h1>');
		assert.equal((await request(origin, '/mount/about/?ref=1')).headers.location, '../about?ref=1');
		assert.equal(
			(await request(origin, '/mount/always/http:example.com?ref=1')).headers.location,
			'./http:example.com/?ref=1'
		);
		assert.equal((await request(origin, '/mount/about/', {}, 'POST')).status, 405);
		for (const pathname of [
			'/mount/missing',
			'/mount/a%2Bb.txt',
			'/mount/sub%2Findex.html',
			'/mount/.secret'
		]) {
			const result = await request(origin, pathname, { 'x-forwarded-for': 'first, last' });
			assert.equal(JSON.parse(result.body.toString()).address, 'first');
		}
		const dynamic = await request(origin, '/mount/dynamic?scope=one', {
			'x-proto': 'http',
			'x-host': 'public.example',
			'x-port': '8080',
			'x-forwarded-for': 'first, last'
		});
		assert.deepEqual(JSON.parse(dynamic.body.toString()), {
			url: 'http://public.example:8080/mount/dynamic?scope=one',
			address: 'first',
			scope: '?scope=one'
		});
		assert.equal((await request(origin, '/mount/read')).body.toString(), 'plain');
		assert.equal((await request(origin, '/dynamic', { 'x-proto': 'http://evil' })).status, 400);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		for (const key of Object.keys(process.env))
			if (key.startsWith('DEPLOY_')) delete process.env[key];
		rmSync(root, { recursive: true, force: true });
	}
});

test('the generated environment validates timeouts, byte sizes and prefix isolation', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-node-env-'));
	try {
		await adapter({ out: root + '/build', precompress: false, envPrefix: 'CONFIG_' }).adapt(
			fixture(root)
		);
		const { env } = await import(pathToFileURL(root + '/build/env.js').href);
		assert.equal(env.integer('IDLE_TIMEOUT'), undefined);
		assert.equal(env.integer('IDLE_TIMEOUT', 30), 30);
		for (const [raw, value] of [
			['0', 0],
			['60', 60]
		] as const) {
			process.env.CONFIG_IDLE_TIMEOUT = raw;
			assert.equal(env.integer('IDLE_TIMEOUT'), value);
		}
		for (const raw of ['-1', 'abc', '1.5']) {
			process.env.CONFIG_IDLE_TIMEOUT = raw;
			assert.throws(() => env.integer('IDLE_TIMEOUT'));
		}
		for (const [raw, value] of [
			['200', 200],
			['512K', 524288],
			['200M', 209715200],
			['1G', 1073741824],
			['Infinity', Infinity]
		] as const) {
			process.env.CONFIG_BODY_SIZE_LIMIT = raw;
			assert.equal(env.bytes('BODY_SIZE_LIMIT', '512K'), value);
		}
		process.env.CONFIG_BODY_SIZE_LIMIT = 'asdf';
		assert.throws(() => env.bytes('BODY_SIZE_LIMIT', '512K'));
	} finally {
		delete process.env.CONFIG_IDLE_TIMEOUT;
		delete process.env.CONFIG_BODY_SIZE_LIMIT;
		rmSync(root, { recursive: true, force: true });
	}
});

test('the shipped listener reports its assigned IPv6 port and force-closes a stream at shutdown', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'adapter-node-listen-'));
	const out = root + '/build';
	process.env.LISTENER_HOST = '::1';
	process.env.LISTENER_PORT = '0';
	process.env.LISTENER_SHUTDOWN_TIMEOUT = '0';
	process.env.LISTENER_KEEP_ALIVE_TIMEOUT = '3';
	process.env.LISTENER_HEADERS_TIMEOUT = '4';
	const messages: string[] = [];
	const log = console.log;
	console.log = (message) => messages.push(String(message));
	let server: http.Server | undefined;
	try {
		await adapter({ out, envPrefix: 'LISTENER_' }).adapt(fixture(root));
		({ server } = await import(pathToFileURL(out + '/index.js').href));
		await once(server!, 'listening');
		const address = server!.address();
		assert(address && typeof address === 'object');
		assert(messages.includes(`Listening on http://[::1]:${address.port}`));
		assert.equal(server!.keepAliveTimeout, 3000);
		assert.equal(server!.headersTimeout, 4000);
		const events = await fetch(`http://[::1]:${address.port}/events`);
		assert.equal(events.headers.get('x-accel-buffering'), 'no');
		const reader = events.body!.getReader();
		await reader.read();
		const stopped = once(process, 'vigla:shutdown');
		process.emit('SIGTERM');
		assert.deepEqual(await stopped, ['SIGTERM']);
		await assert.rejects(reader.read());
		assert.equal(server!.listening, false);
	} finally {
		console.log = log;
		server?.closeAllConnections();
		server?.close();
		for (const key of Object.keys(process.env))
			if (key.startsWith('LISTENER_')) delete process.env[key];
		rmSync(root, { recursive: true, force: true });
	}
});
