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
		'{"type":"module","dependencies":{"@sveltejs/kit":"workspace:@vigla/kit@*"}}'
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write(
		'src/routes/state/reset-states/+server.ts',
		`export function POST() {
		const pathname = new URL(import.meta.url).pathname;
		if (!/reset-states\\/[+_]server\\.js$/.test(pathname)) throw new Error('Unexpected endpoint identity: ' + pathname);
		return new Response(pathname);
	}`
	);
	const vite = await importVite(root);
	const builder = await vite.createBuilder({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit(),
		build: { minify: false }
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
