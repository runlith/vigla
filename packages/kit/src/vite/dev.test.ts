import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { ViteDevServer } from 'vite';
import { sveltekit } from './index.ts';
import { importVite } from '../config/file.ts';
import { packageDirectory } from './paths.ts';

let root: string;
let external: string;
let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), 'kit-dev-')));
	external = realpathSync(mkdtempSync(path.join(tmpdir(), 'kit-assets-')));
	writeFileSync(path.join(external, 'asset.txt'), 'outside asset');
	const write = (file: string, content: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, content);
	};
	write(
		'package.json',
		'{"name":"dev-fixture","type":"module","dependencies":{"@sveltejs/kit":"workspace:@vigla/kit@*"}}'
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	const require = createRequire(path.join(packageDirectory, 'package.json'));
	symlinkSync(
		path.dirname(require.resolve('vite/package.json')),
		path.join(root, 'node_modules/vite'),
		'dir'
	);
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write(
		'src/hooks.server.js',
		'export function handleError({ error }) { return { message: error.message, stack: error.stack }; }'
	);
	write(
		'src/routes/failure/+server.js',
		'export function GET() { throw new Error("fixture failure"); }'
	);
	write(
		'src/routes/styles/encöded/+page.view.js',
		'import "./styles.css"; import "./excluded.css?raw"; import "./excluded.css?url"; import "./excluded.css?inline"; export default function Page(output, props) { output.push("<p class=ordered>styles</p><pre>" + JSON.stringify(props.data.platform) + "</pre>"); }'
	);
	write(
		'src/routes/styles/encöded/+page.js',
		'export const csr = false; export const prerender = true; export const config = { owner: "universal" }; export async function load({ data }) { await import("./dynamic.js"); return data; }'
	);
	write(
		'src/routes/styles/encöded/+page.server.js',
		'export const config = { owner: "server", server: true }; export function load({ platform }) { return { platform }; }'
	);
	write(
		'src/routes/read/+server.js',
		`import { read } from '$app/server'; import local from '../../asset.txt?url'; import external from ${JSON.stringify(path.join(external, 'asset.txt') + '?url')}; export async function GET() { const first = read(local), second = read(external); return Response.json({ local: await first.text(), external: await second.text(), length: first.headers.get('content-length') }); }`
	);
	write('src/routes/styles/encöded/dynamic.js', 'import "./dynamic.css";');
	write('src/routes/styles/encöded/dynamic.css', '#dynamic { color: purple; }');
	write('src/routes/styles/encöded/styles.css', '@import "./base.css"; .ordered { color: green; }');
	write('src/routes/styles/encöded/base.css', '.ordered { color: red; }');
	write('src/routes/styles/encöded/excluded.css', '.excluded { color: blue; }');
	write('static/file.txt', 'public asset');
	write('private.txt', 'root asset');
	write('src/asset.txt', 'source asset');
	const vite = await importVite(root);
	server = await vite.createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit({
			extensions: ['.view.js'],
			adapter: { name: 'fixture', adapt() {}, emulate: () => ({ platform: (details) => details }) }
		}),
		server: { port: 0, fs: { allow: [external] } },
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
	if (external) rmSync(external, { recursive: true, force: true });
});

test('dev errors retain the application message and source frame', async () => {
	const response = await fetch(origin + '/failure');
	expect(response.status).toBe(500);
	const body = await response.json();
	expect(body.message).toBe('fixture failure');
	expect(body.stack).toContain('src/routes/failure/+server.js:');
});

test('SSR includes ordered and dynamically imported CSS without applying raw, url or inline imports', async () => {
	const response = await fetch(origin + '/styles/enc%C3%B6ded');
	const html = await response.text();
	expect(response.status, html).toBe(200);
	expect(html).toContain('#dynamic');
	expect(html).toContain('.ordered');
	expect(html.lastIndexOf('color: green')).toBeGreaterThan(html.lastIndexOf('color: red'));
	expect(html).not.toContain('.excluded');
	expect(html).toContain(
		JSON.stringify({ config: { owner: 'universal', server: true }, prerender: true })
	);
});

test('dev read streams imported project and filesystem URLs with their asset sizes', async () => {
	const response = await fetch(origin + '/read');
	expect(response.status, await response.clone().text()).toBe(200);
	expect(await response.json()).toEqual({
		local: 'source asset',
		external: 'outside asset',
		length: '12'
	});
});

test('generated route-node URLs are served from the application output directory', async () => {
	const response = await fetch(origin + '/.svelte-kit/generated/dev/client/nodes/2.js');
	expect(response.status, await response.clone().text()).toBe(200);
	expect(response.headers.get('content-type')).toContain('javascript');
	expect(await response.text()).toContain('universal');
});

test('public assets bypass Vite while root-file fallbacks keep its filesystem restrictions', async () => {
	expect(await (await fetch(origin + '/file.txt')).text()).toBe('public asset');
	expect((await fetch(origin + '/static/file.txt')).status).toBe(403);
	expect((await fetch(origin + '/private.txt')).status).toBe(403);
	expect(await (await fetch(origin + '/src/asset.txt')).text()).toBe('source asset');
});
