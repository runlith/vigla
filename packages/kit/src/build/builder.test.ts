import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { resolveConfig, validateConfig } from '../config/index.ts';
import type { ServerManifest } from '../types/internal/server.ts';
import { createBuilder, createLogger } from './builder.ts';
import { specifier, write } from './files.ts';
import { manifestSource } from './manifest.ts';
import type { BuildContext } from './types.ts';

let directory: string;
beforeAll(() => {
	directory = mkdtempSync(path.join(os.tmpdir(), 'kit-builder-'));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));
function context(name: string): BuildContext {
	const root = path.join(directory, name);
	const config = resolveConfig(validateConfig({ outDir: '.svelte-kit' }), root);
	return {
		root,
		config,
		mode: 'production',
		tree: {
			assets: [{ file: 'document.html', type: 'application/xhtml+xml' }],
			hooks: { server: null, client: null, universal: null },
			params: null,
			nodes: [],
			routes: []
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
		analysis: { nodes: [], routes: new Map(), remotes: new Map(), environment: {} },
		prerendered: { pages: new Map(), assets: new Map(), redirects: new Map(), paths: [] },
		prerenderMap: new Map(),
		manifest: { immutable: [], assets: [], prerendered: [], routes: [] },
		environment: {},
		log: createLogger(false)
	};
}

test('the adapter Builder copies public output and preserves declared MIME types', () => {
	const input = context('copy');
	const output = path.join(input.config.outDir, 'output');
	write(path.join(output, 'client/app.js'), 'export const value = 1;');
	write(path.join(output, 'client/.vite/manifest.json'), '{}');
	write(path.join(output, 'client/document.html'), '<html></html>');
	write(path.join(output, 'prerendered/dependencies/favicon.ico'), new Uint8Array([0]));
	write(path.join(output, 'prerendered/pages/index.html'), '<h1>page</h1>');
	const builder = createBuilder(input);
	const destination = path.join(input.root, 'public');
	expect(builder.writeClient(destination).sort()).toEqual(['app.js', 'document.html']);
	expect(builder.writePrerendered(destination).sort()).toEqual(['favicon.ico', 'index.html']);
	expect(builder.mimeTypes).toMatchObject({
		'.html': 'application/xhtml+xml',
		'.js': 'text/javascript',
		'.ico': 'image/x-icon'
	});
	expect(readFileSync(path.join(destination, 'index.html'), 'utf8')).toBe('<h1>page</h1>');
});

test('the adapter Builder produces compressed representations without changing source files', async () => {
	const input = context('compress');
	const builder = createBuilder(input);
	write(path.join(input.root, 'files/text.md'), 'compressible text');
	write(path.join(input.root, 'files/asset.png'), new Uint8Array([1, 2]));
	expect(await builder.compress(path.join(input.root, 'files'))).toEqual(['text.md']);
	expect(gunzipSync(readFileSync(path.join(input.root, 'files/text.md.gz'))).toString()).toBe(
		'compressible text'
	);
	expect(
		brotliDecompressSync(readFileSync(path.join(input.root, 'files/text.md.br'))).toString()
	).toBe('compressible text');
	expect(await builder.compress(path.join(input.root, 'absent'))).toEqual([]);
});

test('generated deployment manifests retain root nodes and reindex selected routes', () => {
	const input = context('manifest');
	input.tree.nodes = Array.from({ length: 4 }, () => ({ depth: 0, parent: null, options: null }));
	input.artifacts.nodes = input.tree.nodes.map((_, index) => ({
		component: `entries/component${index}.js`,
		imports: [],
		stylesheets: [],
		fonts: []
	}));
	input.tree.routes = ['one', 'two'].map((name, index) => ({
		id: '/' + name,
		parent: null,
		segment: name,
		pattern: new RegExp(`^/${name}$`),
		params: [],
		layout: null,
		error: null,
		leaf: index + 2,
		endpoint: null,
		page: { layouts: [0], errors: [1], leaf: index + 2 }
	}));
	for (const route of input.tree.routes)
		input.analysis.routes.set(route.id, {
			config: {},
			methods: ['GET'],
			page: { methods: ['GET'] },
			api: { methods: [] },
			prerender: false
		});
	const builder = createBuilder(input);
	const source = manifestSource({
		context: input,
		routes: [builder.routes[1]!],
		relativePath: './server'
	});
	const manifest = new Function('return ' + source)() as ServerManifest;
	expect(manifest.nodes).toHaveLength(3);
	expect(manifest.routes.map((route) => route.id)).toEqual(['/two']);
	expect(manifest.routes[0]!.page).toEqual({ layouts: [0], errors: [1], leaf: 2 });
});

test('instrumentation observes initialized environment and preserves named exports', async () => {
	const input = context('instrument');
	const builder = createBuilder(input);
	const state = path.join(input.root, 'state.js');
	const entry = path.join(input.root, 'entry.js');
	const instrumentation = path.join(input.root, 'instrumentation.server.js');
	write(path.join(input.root, 'package.json'), '{"type":"module"}');
	write(state, 'export const state = {};');
	write(
		path.join(builder.getServerDirectory(), 'env.js'),
		`import { state } from ${JSON.stringify(specifier(builder.getServerDirectory(), state))}; export async function set_env(env) { await Promise.resolve(); state.value = env.VALUE; }`
	);
	write(instrumentation, `import { state } from './state.js'; state.observed = state.value;`);
	write(
		entry,
		`import { state } from './state.js'; const removed = 2; export { removed as delete }; export const entry = 3; export default state.observed;`
	);
	const initializer = builder.createInstrumentationInitializer({
		outputDirectory: input.root,
		environment: `export default { VALUE: 'ready' };`
	});
	builder.instrument({
		entrypoint: entry,
		instrumentation,
		initializer,
		module: { exports: ['default', 'delete', 'entry'] }
	});
	const result = await import(pathToFileURL(entry).href);
	expect({ ...result }).toEqual({ default: 'ready', delete: 2, entry: 3 });
});
