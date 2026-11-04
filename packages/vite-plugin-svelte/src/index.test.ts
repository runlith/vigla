import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PluginAPI } from '@vigla/vite-plugin';
import { createServer, resolveConfig } from 'vite';
import { expect, onTestFinished, test } from 'vitest';
import { svelte } from './index.ts';

test('svelte() names its marker and plugins as vite-plugin-svelte', () => {
	expect(svelte.marker).toBe('vite-plugin-svelte');
	expect(svelte({ configFile: false }).map((plugin) => plugin.name)).toEqual([
		'vite-plugin-svelte',
		'vite-plugin-svelte:config',
		'vite-plugin-svelte:setup-optimizer',
		'vite-plugin-svelte:load-compiled-css',
		'vite-plugin-svelte:load-custom',
		'vite-plugin-svelte:preprocess',
		'vite-plugin-svelte:compile',
		'vite-plugin-svelte:compile-module',
		'vite-plugin-svelte:hot-update'
	]);
});

test("svelte() rejects a misplaced svelte config option in upstream's words", async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-svelte-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
	await writeFile(
		join(root, 'svelte.config.js'),
		'export default { prebundleSvelteLibraries: true };\n'
	);
	await expect(
		resolveConfig(
			{
				root,
				configFile: false,
				logLevel: 'silent',
				plugins: svelte({ configFile: 'svelte.config.js' })
			},
			'serve'
		)
	).rejects.toThrow(
		new Error(
			"Invalid options in svelte config. Move the following options into 'vitePlugin:{...}': prebundleSvelteLibraries"
		)
	);
});

test('svelte() accepts upstream option names and shows upstream names for styles and warnings', async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-svelte-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	const frontend = join(root, 'node_modules', 'text-frontend');
	await mkdir(frontend, { recursive: true });
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ type: 'module', dependencies: { 'text-frontend': '1.0.0' } })
	);
	await writeFile(
		join(frontend, 'package.json'),
		JSON.stringify({
			name: 'text-frontend',
			version: '1.0.0',
			type: 'module',
			exports: { './compiler': './compiler.js', './package.json': './package.json' },
			vigla: {
				frontEnd: {
					compiler: './compiler',
					components: ['.text'],
					modules: { infixes: ['.text.'], extensions: ['.js'] },
					condition: 'text',
					config: 'svelte.config'
				}
			}
		})
	);
	await writeFile(
		join(frontend, 'compiler.js'),
		`export function compile() {
	return {
		js: { code: 'export default 1', map: null },
		css: { code: '.a{color:red}', map: null, hasGlobal: true },
		warnings: [{ code: 'note', message: 'noted', filename: 'a.text' }]
	};
}
export { compile as compileModule };
export async function preprocess(source) { return { code: source }; }
`
	);
	await writeFile(join(root, 'a.text'), 'a');
	await writeFile(
		join(root, 'svelte.config.js'),
		`export default {
	vitePlugin: {
		prebundleSvelteLibraries: false,
		experimental: { sendWarningsToBrowser: true, disableSvelteResolveWarnings: true, inspector: true }
	}
};
`
	);
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: svelte(),
		optimizeDeps: { noDiscovery: true },
		server: { hmr: false, middlewareMode: true, watch: null }
	});
	try {
		const events: string[] = [];
		const send = server.ws.send.bind(server.ws);
		server.ws.send = ((event: unknown) => {
			if (typeof event === 'string') events.push(event);
			return send(event as never);
		}) as typeof server.ws.send;
		const api = server.config.plugins.find((plugin) => plugin.name === 'vite-plugin-svelte')
			?.api as PluginAPI;
		expect(api.options.prebundleLibraries).toBe(false);
		expect(api.options.experimental?.disableResolveWarnings).toBe(true);
		expect(api.options.inspector).toBe(true);
		const component = await server.transformRequest('/a.text');
		const style = component?.code.match(/"([^"]+\?svelte&type=style&lang\.css)"/)?.[1];
		expect(style).toBeDefined();
		expect((await server.transformRequest(style!))?.code).toContain('.a{color:red}');
		expect(events).toContain('svelte:warnings');
	} finally {
		await server.close();
	}
});
