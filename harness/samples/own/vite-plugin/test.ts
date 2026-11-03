import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { expect, inject, onTestFinished, test } from 'vitest';
import type { InlineConfig, ViteDevServer } from 'vite';
import type { Browser, Page } from 'playwright-core';
import type { Options } from '@vigla/vite-plugin-svelte';
import type { Target } from '../../../src/target.ts';
import './mapping.ts';

type Plugin = typeof import('@vigla/vite-plugin-svelte');

interface Project {
	root: string;
	config: InlineConfig;
	vite: typeof import('vite');
	require: NodeJS.Require;
}

async function file(root: string, name: string, contents: string): Promise<void> {
	const path = join(root, name);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents);
}

async function project(files: Readonly<Record<string, string>>, options: Options | ((plugin: Plugin) => Options) = {}): Promise<Project> {
	const target: Target = inject('target');
	const home = join(target.root, 'vite-plugin');
	const require = createRequire(join(home, 'package.json'));
	const vite = (await import(pathToFileURL(require.resolve('vite')).href)) as typeof import('vite');
	const plugin = (await import(
		pathToFileURL(require.resolve('@sveltejs/vite-plugin-svelte')).href
	)) as Plugin;
	const configured = typeof options === 'function' ? options(plugin) : options;
	const work = join(home, '.work');
	await mkdir(work, { recursive: true });
	const root = await mkdtemp(join(work, 'frozen-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	await file(
		root,
		'package.json',
		JSON.stringify({ type: 'module', dependencies: { svelte: '*', vite: '*' } })
	);
	for (const [name, contents] of Object.entries(files)) await file(root, name, contents);
	return {
		root,
		vite,
		require,
		config: {
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: plugin.svelte({
				...configured,
				configFile: false,
				compilerOptions: {
					...configured.compilerOptions,
					runes: true,
					experimental: { ...configured.compilerOptions?.experimental, async: true }
				}
			}),
			optimizeDeps: { noDiscovery: true },
			server: {
				host: '127.0.0.1',
				port: 0,
				watch: { usePolling: true, interval: 20 }
			}
		}
	};
}

async function browse(project: Project, run: (page: Page, server: ViteDevServer) => Promise<void>): Promise<void> {
	const server = await project.vite.createServer(project.config);
	let browser: Browser | undefined;
	try {
		await server.listen();
		const { chromium } = project.require('playwright-core') as typeof import('playwright-core');
		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage();
		await page.goto(server.resolvedUrls!.local[0]!);
		await run(page, server);
	} finally {
		await browser?.close();
		await server.close();
	}
}

test("preprocessed styles keep each project's aliases", async () => {
	for (const color of ['red', 'blue']) {
		const fixture = await project({
			'App.svelte': '<main>color</main><style lang="scss">@use "@tone/colors" as *; main { color: $tone; }</style>',
			'theme/_colors.scss': `$tone: ${color};`,
			'entry.js': 'import { mount } from "svelte"; import App from "./App.svelte"; mount(App, { target: document.body });',
			'index.html': '<script type="module" src="/entry.js"></script>'
		}, plugin => ({ preprocess: plugin.vitePreprocess() }));
		const result = await fixture.vite.build({
			...fixture.config,
			resolve: { alias: { '@tone': join(fixture.root, 'theme') } },
			css: { preprocessorMaxWorkers: 1 },
			build: { write: false, cssMinify: false }
		});
		if (!('output' in result)) throw new Error('expected a single build output');
		const css = result.output.find(entry => entry.type === 'asset' && entry.fileName.endsWith('.css'));
		expect(String(css?.source)).toMatch(new RegExp(`color:\\s*${color}`));
	}
});

test('imported style URLs retain their source directory and scoping', async () => {
	for (const configured of [false, true]) {
		const fixture = await project({
			'App.svelte': '<main class="asset">asset</main><style>@import "./lib/style.css";</style>',
			'lib/style.css': '@import "./nested/asset.css";',
			'lib/nested/asset.css': '.asset { background-image: url("./image.png?asset=1#tile"); border-image-source: image-set("./set.png" 1x); mask-image: url("@scope/icons/tile.png"); position: sticky; }',
			'lib/nested/image.png': 'imported-image',
			'lib/nested/set.png': 'imported-set',
			'node_modules/@scope/icons/package.json': '{"name":"@scope/icons","exports":{"./tile.png":"./tile.png"}}',
			'node_modules/@scope/icons/tile.png': 'package-image',
			...(configured ? { 'postcss.config.cjs': 'module.exports = { plugins: [{ postcssPlugin: "color", Declaration(decl) { if (decl.prop === "position") decl.value = "fixed"; } }] };' } : {}),
			'entry.js': 'import { mount } from "svelte"; import App from "./App.svelte"; mount(App, { target: document.getElementById("app") });',
			'index.html': '<div id="app"></div><script type="module" src="/entry.js"></script>'
		}, plugin => ({ preprocess: plugin.vitePreprocess() }));
		const result = await fixture.vite.build({
			...fixture.config,
			build: { write: false, assetsInlineLimit: 0, cssMinify: false }
		});
		if (!('output' in result)) throw new Error('expected a single build output');
		const assets = result.output.filter(entry => entry.type === 'asset');
		const css = String(assets.find(entry => entry.fileName.endsWith('.css'))?.source);
		for (const [content, suffix] of [['imported-image', '?asset=1#tile'], ['imported-set', ''], ['package-image', '']]) {
			const asset = assets.find(entry => (typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source)) === content);
			expect(asset, content).toBeDefined();
			expect(css).toContain(`${asset!.fileName.split('/').at(-1)}${suffix}`);
		}
		expect(css).toMatch(/\.asset(?::where\()?\.[\w-]+/);
		expect(css).toMatch(new RegExp(`position:\\s*${configured ? 'fixed' : 'sticky'}`));
	}
});

test('style tags in strings retain their literal value', async () => {
	const { config, vite } = await project({
		'App.svelte': '<main><pre><code>{text}</code></pre></main>\n<style>pre { color: green; }</style>\n<script lang="ts">let text = $state(`<style>Style3</style>`)</script>'
	});
	const server = await vite.createServer({
		...config,
		server: { middlewareMode: true, watch: null, hmr: { port: 0 } }
	});
	try {
		const { default: App } = await server.ssrLoadModule('/App.svelte');
		const { render } = await server.ssrLoadModule('svelte/server');
		const output = await render(App);
		const dom = new JSDOM(output.body);
		try {
			expect(dom.window.document.querySelector('code')?.textContent).toBe('<style>Style3</style>');
		} finally {
			dom.window.close();
		}
	} finally {
		await server.close();
	}
});

test('dependency events match normalized and native Windows paths', async () => {
	type Provider = 'Postcss' | 'Sass';
	const colors: Record<Provider, string> = { Postcss: 'red', Sass: 'red' };
	const paths: Record<Provider, string> = {
		Postcss: 'C:/external/mixins.pcss',
		Sass: String.raw`C:\external\dep.scss`
	};
	const fixture = await project({
		'Postcss.svelte': '<h1>Postcss</h1><style>h1{color:red}</style>',
		'Sass.svelte': '<h1>Sass</h1><style>h1{color:red}</style>',
		'entry.js': 'import { mount } from "svelte"; import Postcss from "./Postcss.svelte"; import Sass from "./Sass.svelte"; mount(Postcss, { target: document.getElementById("Postcss") }); mount(Sass, { target: document.getElementById("Sass") });',
		'index.html': '<div id="Postcss"></div><div id="Sass"></div><script type="module" src="/entry.js"></script>'
	}, {
		preprocess: {
			style({ filename }) {
				const name: Provider = filename?.endsWith('Postcss.svelte') ? 'Postcss' : 'Sass';
				return { code: `h1{color:${colors[name]}}`, dependencies: [paths[name]] };
			}
		}
	});
	await browse(fixture, async (page, server) => {
		const color = (name: Provider) => page.locator(`#${name} h1`).evaluate(element => getComputedStyle(element).color);
		for (const name of ['Postcss', 'Sass'] as const) {
			await expect.poll(() => color(name), { timeout: 5000 }).toBe('rgb(255, 0, 0)');
		}
		colors.Sass = 'blue';
		server.watcher.emit('change', String.raw`C:\external\dep.scss`);
		await expect.poll(() => color('Sass'), { timeout: 5000 }).toBe('rgb(0, 0, 255)');
		colors.Postcss = 'blue';
		server.watcher.emit('change', String.raw`C:\external\mixins.pcss`);
		await expect.poll(() => color('Postcss'), { timeout: 5000 }).toBe('rgb(0, 0, 255)');
	});
});

test('dependency scan crawls components exporting template snippets', async () => {
	const fixture = await project({
		'Snippet.svelte': '﻿<script module>\n\timport "scanned-module";\n\t{ var shared = 1; }\n\texport { row, shared };\n</script>\n\n{#snippet row()}<p>row</p>{/snippet}\n',
		'App.svelte': '<script lang="ts">\n\timport { row } from "./Snippet.svelte";\n\tconst rows: unknown = row;\n\timport.meta.glob("./lazy/*.js", { eager: true });\n</script>\n\n<p>{String(rows)}</p>\n<style lang="scss">$tone: red; p { &:hover { color: $tone; } }</style>\n',
		'lazy/one.js': 'import "scanned-glob";',
		'node_modules/scanned-module/package.json': '{"name":"scanned-module","type":"module","main":"index.js"}',
		'node_modules/scanned-module/index.js': 'export {};',
		'node_modules/scanned-glob/package.json': '{"name":"scanned-glob","type":"module","main":"index.js"}',
		'node_modules/scanned-glob/index.js': 'export {};',
		'entry.js': 'import { mount } from "svelte"; import App from "./App.svelte"; mount(App, { target: document.body });',
		'index.html': '<script type="module" src="/entry.js"></script>'
	});
	const errors: string[] = [];
	const logger = fixture.vite.createLogger('silent');
	logger.error = (message) => void errors.push(message);
	const server = await fixture.vite.createServer({
		...fixture.config,
		customLogger: logger,
		optimizeDeps: { noDiscovery: false }
	});
	try {
		await server.listen();
		const discovered = () => {
			const metadata = server.environments.client.depsOptimizer?.metadata;
			return Object.keys({ ...metadata?.optimized, ...metadata?.discovered });
		};
		await expect.poll(() => errors.length > 0 || ['scanned-glob', 'scanned-module'].every((name) => discovered().includes(name)), { timeout: 10000 }).toBe(true);
		expect(errors).toEqual([]);
	} finally {
		await server.close();
	}
});

test('parent replacement keeps child hot updates live', async () => {
	const parent = (text: string) => `<script>import Counter from "./Counter.svelte";</script><h1>${text}</h1><Counter />`;
	const fixture = await project({
		'App.svelte': parent('parent one'),
		'Counter.svelte': '<p>child one</p>',
		'entry.js': 'import { mount } from "svelte"; import App from "./App.svelte"; mount(App, { target: document.getElementById("app") });',
		'index.html': '<div id="app"></div><script type="module" src="/entry.js"></script>'
	});
	const { root } = fixture;
	await browse(fixture, async (page) => {
		await expect.poll(() => page.locator('p').textContent()).toBe('child one');
		await file(root, 'Counter.svelte', '<p>child two</p>');
		await expect.poll(() => page.locator('p').textContent()).toBe('child two');
		await file(root, 'App.svelte', parent('parent two'));
		await expect.poll(() => page.locator('h1').textContent()).toBe('parent two');
		const notified = page.waitForEvent('console', {
			predicate: (message) => message.text().includes('hot updated: /Counter.svelte')
		});
		await file(root, 'Counter.svelte', '<p>child three</p>');
		await notified;
		await expect.poll(() => page.locator('p').textContent()).toBe('child three');
	});
});
