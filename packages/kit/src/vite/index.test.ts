import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { kit } from './index.ts';
import { importVite } from '../config/file.ts';
import { packageDirectory } from './paths.ts';

let root: string;
let server: ViteDevServer;
let origin: string;
const matcherSource = `import { defineParams } from '@sveltejs/kit/params'; export const params = defineParams({ integer: value => /^[0-9]+$/.test(value) ? Number(value) : undefined });
`;

beforeAll(async () => {
	root = mkdtempSync(path.join(import.meta.dirname, '.test-'));
	const write = (file: string, source: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, source);
	};
	write(
		'package.json',
		JSON.stringify({
			name: 'kit-dev-fixture',
			type: 'module',
			dependencies: { '@sveltejs/kit': 'workspace:@vigla/kit@*' },
			imports: { '#lib/*': './src/lib/*' }
		})
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	write('src/app.html', '<html><head>%vigla.head%</head><body>%vigla.body%</body></html>');
	write('.env', 'PUBLIC_NUMBER=7\nPRIVATE_TOKEN=local-test-private\nsetEnv=present\n');
	write(
		'src/env.ts',
		`import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ PUBLIC_NUMBER: { public: true, schema: Number }, PRIVATE_TOKEN: {}, setEnv: { public: true } });`
	);
	write('src/lib/server/value.js', 'export const value = 23;');
	write('src/params.ts', matcherSource);
	write(
		'src/routes/matched/[value=integer]/+server.ts',
		`export function GET({ params }) { return Response.json(params); }`
	);
	write(
		'src/routes/+server.ts',
		`import { PUBLIC_NUMBER } from '$app/env/public'; import { PRIVATE_TOKEN } from '$app/env/private'; import { value } from '#lib/server/value.js'; export function GET({ url, getClientAddress }) { return Response.json({ number: PUBLIC_NUMBER, token: PRIVATE_TOKEN, value, path: url.pathname, address: !!getClientAddress() }); } export function OPTIONS() { return new Response(null, { status: 204, headers: { 'x-options': 'endpoint' } }); }`
	);
	write('static/file.txt', 'asset content');
	write('src/client.js', `import { value } from '#lib/server/value.js'; export { value };`);
	write('src/lib/value.js', `export const value = 'root';`);
	write('src/lib/nested/leaf.js', `export const value = 'nested';`);
	write(
		'src/aliases.js',
		`import { value as exact } from 'exact'; import { value as child } from 'exact/leaf.js'; import { value as regex } from '$regexChar'; import { value as regexChild } from '$regexChar/leaf.js'; export const result = [exact, child, regex, regexChild];`
	);
	write(
		'src/environment.js',
		`import * as publicEnv from '$app/env/public'; import * as privateEnv from '$app/env/private'; export { publicEnv, privateEnv };`
	);
	write(
		'src/manifest.js',
		`export { assets, routes, immutable, prerendered } from '$app/manifest';`
	);
	server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await kit({
			paths: { base: '/base' },
			alias: {
				exact: 'src/lib/value.js',
				'exact/*': 'src/lib/nested/*',
				$regexChar: 'src/lib/value.js',
				'$regexChar/*': 'src/lib/nested/*'
			}
		}),
		server: { port: 0 },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	await server.listen();
	const address = server.httpServer!.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	origin = `http://localhost:${address.port}`;
}, 30_000);

afterAll(async () => {
	await server?.close();
	if (root) rmSync(root, { recursive: true, force: true });
});

test('kit serves endpoint requests with explicit environment values and prefix paths', async () => {
	const response = await fetch(`${origin}/base/`);
	expect(response.status, await response.clone().text()).toBe(200);
	expect(await response.json()).toEqual({
		number: 7,
		token: 'local-test-private',
		value: 23,
		path: '/base/',
		address: true
	});
	const options = await fetch(`${origin}/base/`, { method: 'OPTIONS' });
	expect(options.status).toBe(204);
	expect(options.headers.get('x-options')).toBe('endpoint');
	const matched = await fetch(`${origin}/base/matched/42`);
	expect(await matched.json()).toEqual({ value: 42 });
});

test('kit resolves exact and wildcard aliases including regular-expression characters', async () => {
	const module = await server.ssrLoadModule('/src/aliases.js');
	expect(module.result).toEqual(['root', 'nested', 'root', 'nested']);
});

test('kit serves assets under the configured base', async () => {
	const response = await fetch(`${origin}/base/file.txt`);
	expect(response.status).toBe(200);
	expect(await response.text()).toBe('asset content');
});

test('the client graph rejects a server-only import reached through package imports', async () => {
	await server.environments.client!.transformRequest('/src/client.js');
	await expect(
		server.environments.client!.transformRequest('/src/lib/server/value.js')
	).rejects.toThrow('server_only_import');
	await expect(server.environments.client!.transformRequest('$env/static/private')).rejects.toThrow(
		'server_only_import'
	);
});

test('route additions and removals invalidate the running server manifest', async () => {
	const file = path.join(root, 'src/routes/added/+server.js');
	const change = (event: 'add' | 'unlink', write: () => void) =>
		new Promise<void>((resolve) => {
			const listener = (changed: string) => {
				if (changed !== file) return;
				server.watcher.off(event, listener);
				resolve();
			};
			server.watcher.on(event, listener);
			write();
		});
	await change('add', () => {
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, `export function GET() { return new Response('added route'); }`);
	});
	const added = await fetch(`${origin}/base/added`);
	expect(await added.text()).toBe('added route');
	await change('unlink', () => rmSync(file));
	expect((await fetch(`${origin}/base/added`)).status).toBe(404);
});

test('the client public environment contains validated named exports without private values', async () => {
	const transformed = await server.environments.client!.transformRequest('$app/env/public');
	const module = await import(`data:text/javascript,${encodeURIComponent(transformed!.code)}`);
	expect({ ...module }).toEqual({ PUBLIC_NUMBER: 7, setEnv: 'present' });
	expect(transformed?.code).not.toContain('local-test-private');
	const serverEnv = await server.ssrLoadModule('/src/environment.js');
	expect({ ...serverEnv.publicEnv }).toEqual({ PUBLIC_NUMBER: 7, setEnv: 'present' });
	expect({ ...serverEnv.privateEnv }).toEqual({ PRIVATE_TOKEN: 'local-test-private' });
});

test('dependency scanning externalizes virtual modules and discovers normal dependencies', async () => {
	const file = path.join(root, 'src/scan.js');
	writeFileSync(
		file,
		`import { assets } from '$app/manifest'; import { env as dynamic } from '$env/dynamic/public'; import * as publicEnv from '$app/env/public'; import * as legacy from '$env/static/public'; import * as cookie from 'cookie'; export const result = [assets, dynamic, publicEnv, legacy, cookie];`
	);
	const vite = await importVite(root);
	const config = await vite.resolveConfig(
		{
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: await kit({ paths: { base: '/base' } }),
			optimizeDeps: { entries: [file] }
		},
		'serve'
	);
	const result = await vite.optimizeDeps(config, true);
	expect(existsSync(result.optimized.cookie!.file)).toBe(true);
});

test('the app manifest publishes development asset and route metadata', async () => {
	const manifest = await server.ssrLoadModule('/src/manifest.js');
	expect(manifest.assets).toEqual([{ path: 'file.txt' }]);
	expect(manifest.routes).toHaveLength(2);
	expect(manifest.routes).toEqual(
		expect.arrayContaining([
			{ id: '/', page: false, endpoint: true },
			{ id: '/matched/[value=integer]', page: false, endpoint: true }
		])
	);
	expect(manifest.immutable).toEqual([]);
	expect(manifest.prerendered).toEqual([]);
});
