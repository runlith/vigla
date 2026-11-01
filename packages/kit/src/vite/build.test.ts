import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { PreviewServer } from 'vite';
import type { Builder } from '../types/builder.ts';
import type { Config } from '../types/config.ts';
import type { ServerManifest } from '../types/internal/server.ts';
import { namespace } from './ids.ts';
import { walk } from '../build/index.ts';
import { sveltekit } from './index.ts';
import { importVite, packageDirectory } from './paths.ts';

let root: string;
let preview: PreviewServer;
let origin: string;
let adapted: Builder;
let rejectPolicy = false;
const policyPaths: string[] = [];
function config(strategy: 'split' | 'single' | 'inline' = 'split'): Config {
	return {
		extensions: ['.view.js'],
		inlineStyleThreshold: 10000,
		version: { name: 'fixture-version' },
		output: { bundleStrategy: strategy },
		prerender: {
			async handleHttpError(details) {
				await Promise.resolve();
				policyPaths.push(details.path);
				if (rejectPolicy) throw new Error('policy rejected ' + details.path);
			}
		},
		adapter: {
			name: 'fixture',
			adapt(builder) {
				adapted = builder;
			}
		}
	};
}
beforeAll(async () => {
	root = mkdtempSync(path.join(import.meta.dirname, '.test-build-'));
	const write = (file: string, value: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, value);
	};
	write(
		'package.json',
		'{"name":"kit-build-fixture","type":"module","dependencies":{"@sveltejs/kit":"workspace:@vigla/kit@*"}}'
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	write('.env', 'PUBLIC_BUILD=rendered-public-value\nPRIVATE_BUILD=server-only-value\n');
	write(
		'src/env.ts',
		`import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ PUBLIC_BUILD: { public: true }, PRIVATE_BUILD: {} });`
	);
	write(
		'src/app.html',
		'<!doctype html><html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>'
	);
	write(
		'src/routes/+page.server.js',
		`import { PUBLIC_BUILD } from '$app/env/public'; export const prerender = true; export const csr = false; export function load() { return { message: PUBLIC_BUILD }; }`
	);
	write(
		'src/routes/api/+server.js',
		`export const prerender = true; export function GET() { return Response.json({ answer: 42 }); }`
	);
	write(
		'src/routes/live/+server.js',
		`import { PRIVATE_BUILD } from '$app/env/private'; export function GET() { return Response.json({ live: true, private: PRIVATE_BUILD }); }`
	);
	write(
		'src/routes/+page.view.js',
		`import './page.css'; import { BROWSER } from 'esm-env'; export default function Page(output, props) { if (!BROWSER) output.push('<p>' + props.data.message + '</p><a href="/entry/7#present">entry</a><a href="/missing">missing</a>'); }`
	);
	write(
		'src/routes/page.css',
		'@font-face{font-family:fixture;src:url("./font.woff2")}p{background:url("./icon.svg")}'
	);
	write('src/routes/font.woff2', 'fixture-font-data');
	write(
		'src/routes/icon.svg',
		'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
	);
	write(
		'src/hooks.server.js',
		`export const handle = ({ event, resolve }) => resolve(event, { preload: () => true });`
	);
	write(
		'src/params.js',
		`import { defineParams } from '@sveltejs/kit/params'; export const params = defineParams({ integer: value => /^[0-9]+$/.test(value) ? Number(value) : undefined });`
	);
	write(
		'src/routes/entry/[id=integer]/+server.js',
		`export const prerender = true; export const entries = () => [{ id: '7' }]; export function GET({params}) { return new Response('<section id="present">' + params.id + '</section>', { headers: { 'content-type': 'text/html' } }); }`
	);
	write('src/routes/shell/+page.js', 'export const ssr = false; export const prerender = true;');
	write('src/routes/shell/+page.view.js', 'export default function Empty() {}');
	write(
		'src/hooks.client.js',
		`import { resolve } from '$app/paths'; import { version } from '$app/env'; import { PUBLIC_BUILD } from '$app/env/public'; import { immutable, prerendered } from '$app/manifest'; globalThis.fixtureBoot = { path: resolve('/shell'), version, value: PUBLIC_BUILD }; globalThis.fixtureManifest = { immutable, prerendered };`
	);
	write(
		'src/service-worker.js',
		`import { immutable, prerendered } from '$app/manifest'; globalThis.fixtureCache = { immutable, prerendered };`
	);
	write('static/asset.txt', 'built asset');
	const vite = await importVite(root);
	const builder = await vite.createBuilder({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit(config()),
		build: { minify: false, assetsInlineLimit: 0 }
	});
	await builder.buildApp();
	preview = await vite.preview({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit(config()),
		preview: { host: '127.0.0.1', port: 0 }
	});
	const address = preview.httpServer.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	origin = `http://127.0.0.1:${address.port}`;
}, 60_000);

afterAll(async () => {
	await preview?.close();
	if (root) rmSync(root, { recursive: true, force: true });
});

test('the app builder emits Kit deployment artifacts and calls the adapter after prerendering', async () => {
	const output = path.join(root, '.svelte-kit/output');
	for (const file of [
		'server/index.js',
		'server/manifest.js',
		'server/manifest-full.js',
		'server/internal.js',
		'client/.vite/manifest.json',
		'client/_app/version.json',
		'client/service-worker.js',
		'prerendered/pages/index.html',
		'prerendered/dependencies/api',
		'prerendered/data/__data.json'
	])
		expect(existsSync(path.join(output, file)), file).toBe(true);
	expect(adapted.prerendered.paths).toEqual(expect.arrayContaining(['/', '/api', '/__data.json']));
	expect(adapted.routes.find((route) => route.id === '/')?.prerender).toBe(true);
	expect(adapted.prerendered.paths).toContain('/entry/7');
	expect(policyPaths).toEqual(['/missing']);
	expect(adapted.manifest.assets).toContainEqual({ path: 'service-worker.js' });
	const { manifest } = (await import(
		pathToFileURL(path.join(output, 'server/manifest.js')).href
	)) as { manifest: ServerManifest };
	expect(manifest.assets.has('service-worker.js')).toBe(true);
	const worker = readFileSync(path.join(output, 'client/service-worker.js'), 'utf8');
	expect(worker).toContain('/entry/7');
	expect(worker).toContain('_app/immutable/');
	expect(worker).not.toContain('__SVELTEKIT_MANIFEST_');
	await adapted.generateFallback(path.join(output, 'fallback.html'));
	const fallback = readFileSync(path.join(output, 'fallback.html'), 'utf8');
	expect(fallback).toContain('<script');
	expect(fallback).not.toContain('<p>rendered-public-value</p>');
	expect(JSON.parse(readFileSync(path.join(output, 'client/_app/version.json'), 'utf8'))).toEqual({
		version: 'fixture-version'
	});
});

test('preview serves prerendered output and the remaining built Server without exposing private env', async () => {
	const page = await fetch(origin + '/');
	const html = await page.text();
	expect(page.status).toBe(200);
	expect(html).toContain('rendered-public-value');
	expect(html).not.toContain('/@vite/client');
	expect(html).not.toContain('/@fs/');
	expect(html).toMatch(/<link[^>]*as="font"/);
	expect(html).toContain('<style');
	expect(html).toContain('./_app/immutable/assets/');
	expect(await (await fetch(origin + '/api')).json()).toEqual({ answer: 42 });
	expect(await (await fetch(origin + '/live')).json()).toEqual({
		live: true,
		private: 'server-only-value'
	});
	expect(await (await fetch(origin + '/asset.txt')).text()).toBe('built asset');
	const client = path.join(root, '.svelte-kit/output/client');
	for (const file of walk(client).filter((file) => file.endsWith('.js')))
		expect(readFileSync(path.join(client, file), 'utf8')).not.toContain('server-only-value');
});

test.each(['single', 'inline'] as const)(
	'%s bundles initialize public boot state before app hook evaluation',
	async (strategy) => {
		await preview.close();
		const vite = await importVite(root);
		const builder = await vite.createBuilder({
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: await sveltekit(config(strategy)),
			build: { minify: false, assetsInlineLimit: 0 }
		});
		await builder.buildApp();
		const output = path.join(root, '.svelte-kit/output');
		const { manifest } = (await import(
			pathToFileURL(path.join(output, 'server/manifest-full.js')).href + '?' + strategy
		)) as { manifest: ServerManifest };
		const payload = {
			base: '/prefix',
			version: 'runtime-version',
			env: { PUBLIC_BUILD: 'runtime-public' }
		};
		const name = namespace('fixture-version', false);
		if (strategy === 'inline') {
			const scope = vm.createContext({
				console,
				URL,
				TextEncoder,
				TextDecoder,
				setTimeout,
				clearTimeout,
				queueMicrotask,
				performance,
				[name]: payload
			});
			scope.window = scope;
			vm.runInContext(manifest.client!.inline!.script, scope);
			expect(scope.fixtureBoot).toEqual({
				path: '/prefix/shell',
				version: 'runtime-version',
				value: 'runtime-public'
			});
			expect(scope.fixtureManifest).toEqual({
				immutable: adapted.manifest.immutable,
				prerendered: adapted.manifest.prerendered
			});
			expect(existsSync(path.join(output, 'client', manifest.client!.start))).toBe(false);
			expect(typeof scope[name].app.start).toBe('function');
			expect(manifest.client!.inline!.style!('/cdn', '/prefix')).toContain(
				'/cdn/_app/immutable/assets/'
			);
		} else {
			const globals = globalThis as unknown as Record<string, unknown>;
			globals[name] = payload;
			try {
				const module = await import(
					pathToFileURL(path.join(output, 'client', manifest.client!.start)).href
				);
				expect(globals.fixtureBoot).toEqual({
					path: '/prefix/shell',
					version: 'runtime-version',
					value: 'runtime-public'
				});
				expect(globals.fixtureManifest).toEqual({
					immutable: adapted.manifest.immutable,
					prerendered: adapted.manifest.prerendered
				});
				expect(typeof module.start).toBe('function');
			} finally {
				delete globals[name];
				delete globals.fixtureBoot;
				delete globals.fixtureManifest;
			}
		}
	}
);

test('a prerender policy exception fails the build in the parent process', async () => {
	rejectPolicy = true;
	try {
		const vite = await importVite(root);
		const builder = await vite.createBuilder({
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: await sveltekit(config()),
			build: { minify: false, assetsInlineLimit: 0 }
		});
		await expect(builder.buildApp()).rejects.toThrow('policy rejected /missing');
	} finally {
		rejectPolicy = false;
	}
});
