import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { ConfiguredServer, ServerModule } from '../types/internal/server.ts';
import { importVite } from '../config/file.ts';
import { sveltekit } from './index.ts';
import { packageDirectory } from './paths.ts';

let root: string;
let server: ConfiguredServer;
beforeAll(async () => {
	root = mkdtempSync(path.join(import.meta.dirname, '.test-artifacts-'));
	const write = (file: string, contents: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, contents);
	};
	write(
		'package.json',
		'{"type":"module","dependencies":{"@sveltejs/kit":"workspace:@vigla/kit@*","svelte":"workspace:@vigla/svelte@*"}}'
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	symlinkSync(
		path.resolve(packageDirectory, '../svelte'),
		path.join(root, 'node_modules/svelte'),
		'dir'
	);
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write(
		'src/routes/state/reset-states/+server.ts',
		`export function POST() {
		const pathname = new URL(import.meta.url).pathname;
		if (!/reset-states\\/[+_]server\\.js$/.test(pathname)) throw new Error('Unexpected endpoint identity: ' + pathname);
		return new Response(pathname);
	}`
	);
	write(
		'src/routes/css/+page.svelte',
		`<script>
		import './eager.css';
		let Dynamic = $state();
		</script>
		<button onclick={async () => { Dynamic = (await import('./Dynamic.svelte')).default; }}>load</button>
		{#if Dynamic}<Dynamic />{/if}`
	);
	write('src/routes/css/Dynamic.svelte', '<script>import "./lazy.css";</script><p>dynamic</p>');
	write(
		'src/routes/css/eager.css',
		'@font-face{font-family:eager;src:url("./eager-font.woff2")}p{color:blue}'
	);
	write(
		'src/routes/css/lazy.css',
		'@font-face{font-family:lazy;src:url("./lazy-font.woff2")}p{color:red}'
	);
	write(
		'src/hooks.server.js',
		'export const handle = ({ event, resolve }) => resolve(event, { preload: () => true });'
	);
	write('src/routes/css/eager-font.woff2', 'eager font');
	write('src/routes/css/lazy-font.woff2', 'lazy font');
	const vite = await importVite(root);
	const builder = await vite.createBuilder({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit({ compilerOptions: { runes: true }, inlineStyleThreshold: 0 }),
		build: { minify: false, assetsInlineLimit: 0 }
	});
	await builder.buildApp();
	const directory = path.join(root, '.svelte-kit/output/server');
	const module = (await import(
		pathToFileURL(path.join(directory, 'index.js')).href
	)) as ServerModule;
	const { manifest } = await import(pathToFileURL(path.join(directory, 'manifest.js')).href);
	server = await module.configure({ manifest, env: {} });
	await server.init();
}, 30_000);

afterAll(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

test('SSR eagerly loads rendered CSS and fonts but leaves browser-only dynamic styles lazy', async () => {
	const response = await server.respond(new Request('https://app.test/css'), {
		getClientAddress: () => '192.0.2.1'
	});
	expect(response.status).toBe(200);
	const html = await response.text();
	expect([...html.matchAll(/<link[^>]*rel="stylesheet"/g)]).toHaveLength(1);
	expect(html).toContain('eager-font.');
	expect(html).not.toContain('Dynamic.');
	expect(html).not.toContain('lazy-font.');
});

test('built endpoint identity preserves its source-relative directory and module name', async () => {
	const response = await server.respond(
		new Request('https://app.test/state/reset-states', {
			method: 'POST',
			headers: { origin: 'https://app.test' }
		}),
		{ getClientAddress: () => '192.0.2.1' }
	);
	expect(response.status).toBe(200);
	expect(await response.text()).toMatch(
		/\/entries\/endpoints\/state\/reset-states\/[+_]server\.js$/
	);
});
