import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { findDepPkgJsonPath } from 'vitefu';
import { createServer, normalizePath, optimizeDeps, resolveConfig } from 'vite';
import { expect, onTestFinished, test } from 'vitest';
import { vigla, type PluginAPI } from './index.ts';

test('compiles opaque source through its claiming front end with custom options intact', async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	const source = 'text </style> stays intact';
	const frontends = [
		{ name: 'number', value: 'Number(source)' },
		{ name: 'text', value: "(options.dev ? 'dev: ' : '') + options.prefix + source" }
	];
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({
			type: 'module',
			dependencies: Object.fromEntries(frontends.map(({ name }) => [`${name}-frontend`, '1.0.0']))
		})
	);
	for (const { name, value } of frontends) {
		const frontend = join(root, 'node_modules', `${name}-frontend`);
		await mkdir(frontend, { recursive: true });
		await writeFile(
			join(frontend, 'package.json'),
			JSON.stringify({
				name: `${name}-frontend`,
				version: '1.0.0',
				type: 'module',
				exports: { './compiler': './compiler.js', './package.json': './package.json' },
				vigla: {
					frontEnd: {
						compiler: './compiler',
						components: [`.${name}`],
						modules: { infixes: [`.${name}.`], extensions: ['.js'] },
						condition: name,
						config: `${name}.config`
					}
				}
			})
		);
		await writeFile(
			join(frontend, 'compiler.js'),
			`${name === 'text' ? 'export const format = { global: "__text", meta: "__text_meta", cssWrapper: "text-css-wrapper" };' : ''}
export function compile(source, options) {
	return {
		js: { code: 'export default ' + JSON.stringify(${value}), map: null },
		css: null,
		warnings: []
	};
}
export { compile as compileModule };
export async function preprocess(source) { return { code: source }; }
`
		);
	}
	await writeFile(join(root, 'message.text'), source);
	await writeFile(join(root, 'message.text.js'), 'const value = 1;');
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: vigla({
			configFile: false,
			compilerOptions: { dev: false, prefix: 'compiled: ' },
			experimental: { compileModule: { infixes: ['.custom.'] } }
		}),
		optimizeDeps: { noDiscovery: true },
		server: { middlewareMode: true, watch: null, hmr: { port: 0 } }
	});
	try {
		const api = server.config.plugins.find((plugin) => plugin.name === 'vigla')?.api as
			| PluginAPI
			| undefined;
		expect(
			api?.frontEnds.find((frontend) => frontend.components.includes('.text'))?.compiler.format
		).toEqual({ global: '__text', meta: '__text_meta', cssWrapper: 'text-css-wrapper' });
		expect(
			api?.frontEnds.find((frontend) => frontend.components.includes('.number'))?.compiler.format
		).toBeUndefined();
		const output = await server.ssrLoadModule('/message.text');
		expect(output.default).toBe(`compiled: ${source}`);
		const module = await server.ssrLoadModule('/message.text.js');
		expect(module.default).toBe('compiled: const value = 1;');
	} finally {
		await server.close();
	}
});

test('shows its own names for component styles, the warnings event and options', async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
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
					config: 'text.config'
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
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: vigla({
			configFile: false,
			prebundleLibraries: false,
			experimental: { sendWarningsToBrowser: true, disableResolveWarnings: true }
		}),
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
		const api = server.config.plugins.find((plugin) => plugin.name === 'vigla')?.api as PluginAPI;
		expect(api.options.prebundleLibraries).toBe(false);
		expect(api.options.experimental?.disableResolveWarnings).toBe(true);
		const component = await server.transformRequest('/a.text');
		const style = component?.code.match(/"([^"]+\?vigla&type=style&lang\.css)"/)?.[1];
		expect(style).toBeDefined();
		expect((await server.transformRequest(style!))?.code).toContain('.a{color:red}');
		expect(events).toContain('vigla:warnings');
	} finally {
		await server.close();
	}
});

test("probes a custom cssHash with a filename of the discovered front end's component extension", async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
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
					config: 'text.config'
				}
			}
		})
	);
	await writeFile(join(frontend, 'compiler.js'), 'export function compile() {}');
	const filenames: string[] = [];
	await resolveConfig(
		{
			root,
			configFile: false,
			logLevel: 'silent',
			plugins: vigla({
				configFile: false,
				compilerOptions: {
					cssHash: ({ filename }: { filename: string }) => {
						filenames.push(filename);
						return 'hash';
					}
				}
			})
		},
		'serve'
	);
	expect(filenames).toEqual(['Foo.text']);
});

test('leaves ordinary JavaScript and dependencies alone when no front end is installed', async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	const dependency = join(root, 'node_modules', 'plain-dependency');
	await mkdir(dependency, { recursive: true });
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ type: 'module', dependencies: { 'plain-dependency': '1.0.0' } })
	);
	await writeFile(
		join(dependency, 'package.json'),
		JSON.stringify({ name: 'plain-dependency', type: 'module', exports: './index.js' })
	);
	await writeFile(join(dependency, 'index.js'), 'export default 42;');
	await writeFile(
		join(root, 'entry.js'),
		'import answer from "plain-dependency"; export { answer };'
	);
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: vigla({
			configFile: false,
			extensions: ['.js'],
			include: /\.js$/,
			experimental: { compileModule: { include: /\.js$/ } }
		}),
		optimizeDeps: { include: ['plain-dependency'], noDiscovery: true },
		server: { middlewareMode: true, watch: null, hmr: { port: 0 } }
	});
	try {
		const api = server.config.plugins.find((plugin) => plugin.name === 'vigla')?.api as PluginAPI;
		expect(api.frontEnds).toEqual([]);
		await optimizeDeps(server.config, true);
		const output = await server.ssrLoadModule('/entry.js');
		expect(output.answer).toBe(42);
	} finally {
		await server.close();
	}
});

test('frontend prebundles share the native core owner', async () => {
	interface Runtime {
		readOwner: typeof import('vigla').getOwner;
	}
	const require = createRequire(import.meta.url);
	const core =
		require('vigla/internal/index-client') as typeof import('vigla/internal/index-client');
	const manifest = await findDepPkgJsonPath('vigla', import.meta.dirname);
	if (manifest === undefined) throw new Error('core package not found');
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
	onTestFinished(() => rm(root, { recursive: true, force: true }));
	const frontend = join(root, 'node_modules', 'owner-frontend');
	await mkdir(join(frontend, 'node_modules'), { recursive: true });
	await symlink(dirname(manifest), join(frontend, 'node_modules', 'vigla'), 'dir');
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ type: 'module', dependencies: { 'owner-frontend': '1.0.0' } })
	);
	await writeFile(
		join(frontend, 'package.json'),
		JSON.stringify({
			name: 'owner-frontend',
			version: '1.0.0',
			type: 'module',
			dependencies: { vigla: '*' },
			exports: { '.': './index.js', './other': './other.js', './compiler': './compiler.js' },
			vigla: {
				frontEnd: {
					compiler: './compiler',
					components: ['.owner'],
					modules: { infixes: ['.owner.'], extensions: ['.js'] },
					condition: 'owner',
					config: 'owner.config'
				}
			}
		})
	);
	await writeFile(join(frontend, 'index.js'), 'export { readOwner } from "./shared.js";');
	await writeFile(join(frontend, 'other.js'), 'export { readOwner } from "./shared.js";');
	await writeFile(
		join(frontend, 'shared.js'),
		'import { getOwner } from "vigla/internal/index-client"; export function readOwner() { return getOwner(); }'
	);
	await writeFile(
		join(frontend, 'compiler.js'),
		'export function compile(source) { return { js: { code: "export default null", map: null }, css: null, warnings: [] }; } export { compile as compileModule }; export async function preprocess(source) { return { code: source }; }'
	);
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: vigla({ configFile: false }),
		optimizeDeps: { noDiscovery: true },
		server: { middlewareMode: true, hmr: false, watch: null }
	});
	try {
		const metadata = await optimizeDeps(server.config, true);
		for (const chunk of Object.values(metadata.chunks)) {
			await server.transformRequest(`/${normalizePath(relative(root, chunk.file))}`);
		}
		const runtimes = ['owner-frontend', 'owner-frontend/other'].map(
			(name) => require(metadata.optimized[name]!.file) as Runtime
		);
		const owner = core.root();
		try {
			for (const runtime of runtimes) expect(owner.run(() => runtime.readOwner())).toBe(owner);
		} finally {
			owner.dispose();
		}
	} finally {
		await server.close();
	}
});
