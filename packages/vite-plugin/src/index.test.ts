import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { expect, test } from 'vitest';
import { svelte } from './index.ts';

test('compiles opaque source through its claiming front end with custom options intact', async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
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
			`export function compile(source, options) {
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
		plugins: svelte({
			configFile: false,
			compilerOptions: { dev: false, prefix: 'compiled: ' },
			experimental: { compileModule: { infixes: ['.custom.'] } }
		}),
		optimizeDeps: { noDiscovery: true },
		server: { middlewareMode: true, watch: null, hmr: { port: 0 } }
	});
	try {
		const output = await server.ssrLoadModule('/message.text');
		expect(output.default).toBe(`compiled: ${source}`);
		const module = await server.ssrLoadModule('/message.text.js');
		expect(module.default).toBe('compiled: const value = 1;');
	} finally {
		await server.close();
		await rm(root, { recursive: true, force: true });
	}
});
