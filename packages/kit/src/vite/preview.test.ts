import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { PreviewServer } from 'vite';
import { importVite } from '../config/file.ts';
import { kit } from './index.ts';
import { packageDirectory } from './paths.ts';

let root: string;
let preview: PreviewServer;
let origin: string;
beforeAll(async () => {
	root = mkdtempSync(path.join(import.meta.dirname, '.test-preview-'));
	const write = (file: string, contents: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, contents);
	};
	write(
		'package.json',
		'{"type":"module","dependencies":{"@sveltejs/kit":"workspace:@vigla/kit@*"}}'
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write('src/routes/+server.js', 'export function GET() { return new Response("fixture"); }');
	const output = '.svelte-kit/output/';
	write(output + 'package.json', '{"type":"module"}');
	write(output + 'client/load/foo.json', '"static file"');
	write(output + 'client/_app/immutable/asset.txt', 'immutable asset');
	write(output + 'client/_app/version.json', '{"version":"fixture"}');
	write(output + 'server/private.txt', 'server asset');
	write(output + 'prerendered/pages/always/index.html', '<h1>always</h1>');
	write(output + 'prerendered/pages/never.html', '<h1>never</h1>');
	write(output + 'prerendered/pages/中文/index.html', '<h1>encoded</h1>');
	write(output + 'prerendered/pages/destination.html', '<h1>prerendered destination</h1>');
	write(output + 'prerendered/dependencies/api.json', '{"prerendered":true}');
	write(output + 'prerendered/data/_app/remote/abc/value', '{"type":"result"}');
	write(
		output + 'prerendered.json',
		JSON.stringify({
			pages: [
				['/base/always/', { file: 'always/index.html' }],
				['/base/never', { file: 'never.html' }],
				['/base/中文/', { file: '中文/index.html' }],
				['/base/destination', { file: 'destination.html' }]
			],
			assets: [
				['/base/api.json', { type: 'application/json' }],
				['/base/_app/remote/abc/value', { type: 'application/json' }]
			],
			redirects: [
				['/base/always', { status: 308, location: '/base/always/' }],
				['/base/never/', { status: 308, location: '/base/never' }],
				['/base/中文', { status: 308, location: '/base/%E4%B8%AD%E6%96%87/' }],
				['/base/moved', { status: 307, location: '/base/never?fixed=1' }]
			],
			paths: ['/base/always/', '/base/never', '/base/中文/', '/base/destination', '/base/api.json']
		})
	);
	write(
		output + 'server/manifest.js',
		`export const manifest = {
		app_dir: '_app', app_path: 'base/_app',
		assets: new Set(['load/foo.json', '_app/immutable/asset.txt', '_app/version.json']),
		mime_types: { '.json': 'application/json', '.txt': 'text/plain' },
		client: null, nodes: [], remotes: {}, matchers: async () => ({}),
		prerendered_routes: new Set(['/base/destination']), server_assets: { 'private.txt': 12 },
		routes: [
			{ id: '/load/foo', pattern: /^\\/load\\/foo\\/?$/, params: [], page: null,
				endpoint: async () => ({ GET: async ({ fetch }) => new Response(await (await fetch('/base/load/foo.json')).json()) }) },
			{ id: '/load/foo.json', pattern: /^\\/load\\/foo\\.json\\/?$/, params: [], page: null,
				endpoint: async () => ({ GET: () => Response.json('endpoint') }) },
			{ id: '/private', pattern: /^\\/private\\/?$/, params: [], page: null,
				endpoint: async () => ({ GET: async ({ fetch }) => new Response(await (await fetch('/base/private.txt')).text()) }) }
		]
	};`
	);
	write(
		output + 'server/index.js',
		`import { Server } from '@sveltejs/kit/internal/server';
		export async function configure(input) {
			const server = new Server(input.manifest, {
				global: '__preview_fixture', root: () => {},
				getHooks: async () => ({ reroute: ({ url }) => url.pathname === '/base/alias' ? '/base/destination' : undefined }),
				templates: { app: ({ body }) => body, error: ({ status, message }) => status + ':' + message },
				appTemplateContainsNonce: false, csp: {}, csrf: { checkOrigin: true, trustedOrigins: [] },
				paths: { base: '/base', assets: input.assets, relative: false },
				env: { set: () => ({ public: {}, private: {}, rendered: {} }) },
				serviceWorker: null, version: { name: 'fixture', pollInterval: 0 },
				output: { bundleStrategy: 'split', linkHeaderPreload: false },
				router: { type: 'pathname', resolution: 'client' }, embedded: false, tracing: { server: false },
				dev: false, building: false, prerendering: false
			});
			await server.configure(input);
			return { init: () => server.init(input), respond: (request, options) => server.respond(request, options), set_env: () => {} };
		}`
	);
	const vite = await importVite(root);
	preview = await vite.preview({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await kit({ paths: { base: '/base' } }),
		preview: { host: '127.0.0.1', port: 0 }
	});
	const address = preview.httpServer.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	await preview?.close();
	if (root) rmSync(root, { recursive: true, force: true });
});

test('malformed preview paths return a client error before routing', async () => {
	const response = await fetch(origin + '/base/%c0%ae%c0%ae/etc/passwd');
	expect(response.status).toBe(400);
});

test.each([
	['always', 'always/'],
	['never/', 'never'],
	['%E4%B8%AD%E6%96%87', '%E4%B8%AD%E6%96%87/']
])('prerender canonical redirects preserve encoded paths and queries for %s', async (from, to) => {
	const response = await fetch(origin + '/base/' + from + '?q=%2f+%25', { redirect: 'manual' });
	expect(response.status).toBe(308);
	expect(new URL(response.headers.get('location')!, origin + '/base/' + from).href).toBe(
		origin + '/base/' + to + '?q=%2f+%25'
	);
});

test('explicit prerender redirects retain their own location', async () => {
	const response = await fetch(origin + '/base/moved?discard=1', { redirect: 'manual' });
	expect(response.status).toBe(307);
	expect(response.headers.get('location')).toBe('/base/never?fixed=1');
});

test('preview terminates DevTools discovery without the application error response', async () => {
	const response = await fetch(origin + '/.well-known/appspecific/com.chrome.devtools.json');
	expect(response.status).toBe(404);
	expect(await response.text()).toBe('not found');
});

test('preview routes to prerendered output without changing the requested URL', async () => {
	const response = await fetch(origin + '/base/alias?q=%2f+%25');
	expect(response.status).toBe(200);
	expect(response.url).toBe(origin + '/base/alias?q=%2f+%25');
	expect(await response.text()).toBe('<h1>prerendered destination</h1>');
});

test('request fetches read deployed static data ahead of endpoints and retain server assets', async () => {
	const response = await fetch(origin + '/base/load/foo');
	expect(response.status).toBe(200);
	expect(await response.text()).toBe('static file');
	expect(await (await fetch(origin + '/base/private')).text()).toBe('server asset');
});

test('preview retains immutable, version and prerender dependency representations', async () => {
	const asset = await fetch(origin + '/base/_app/immutable/asset.txt');
	expect(await asset.text()).toBe('immutable asset');
	expect(asset.headers.get('cache-control')).toContain('immutable');
	const cached = await fetch(origin + '/base/_app/immutable/asset.txt', {
		headers: { 'if-none-match': asset.headers.get('etag')! }
	});
	expect(cached.status).toBe(304);
	expect(await cached.text()).toBe('');
	const version = await fetch(origin + '/base/_app/version.json');
	expect(await version.json()).toEqual({ version: 'fixture' });
	expect(version.headers.get('cache-control')).not.toContain('immutable');
	const dependency = await fetch(origin + '/base/api.json');
	expect(dependency.headers.get('content-type')).toBe('application/json');
	expect(await dependency.json()).toEqual({ prerendered: true });
});

test('preview serves prerendered remote function results from the data output', async () => {
	const response = await fetch(origin + '/base/_app/remote/abc/value');
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ type: 'result' });
});
