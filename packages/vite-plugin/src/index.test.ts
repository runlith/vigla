import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { expect, test } from 'vitest';
import { svelte } from './index.ts';

test('compiles opaque source through its claiming front end with custom options intact', async () => {
	const root = await mkdtemp(join(tmpdir(), 'vite-plugin-'));
	const frontend = join(root, 'node_modules', 'text-frontend');
	const source = 'text </style> stays intact';
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
		`export function compile(source, options) {
	return {
		js: { code: 'export default ' + JSON.stringify(options.prefix + source), map: null },
		css: null,
		warnings: []
	};
}
export { compile as compileModule };
export async function preprocess(source) { return { code: source }; }
`
	);
	await writeFile(join(root, 'message.text'), source);
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: svelte({ configFile: false, compilerOptions: { prefix: 'compiled: ' } }),
		optimizeDeps: { noDiscovery: true },
		server: { middlewareMode: true, watch: null, hmr: { port: 0 } }
	});
	try {
		const output = await server.ssrLoadModule('/message.text');
		expect(output.default).toBe(`compiled: ${source}`);
	} finally {
		await server.close();
		await rm(root, { recursive: true, force: true });
	}
});
