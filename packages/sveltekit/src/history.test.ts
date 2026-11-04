import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { sveltekit } from './vite.ts';

const facade = fileURLToPath(new URL('..', import.meta.url));
let root: string;
let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), 'sveltekit-history-')));
	const write = (file: string, content: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, content);
	};
	write(
		'package.json',
		'{"name":"history-fixture","type":"module","dependencies":{"@sveltejs/kit":"*"}}'
	);
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(facade, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	symlinkSync(
		realpathSync(path.join(facade, 'node_modules/vite')),
		path.join(root, 'node_modules/vite'),
		'dir'
	);
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write('.env', 'PUBLIC_NUMBER=7\nPRIVATE_TOKEN=secret\n');
	write(
		'src/env.ts',
		`import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ PUBLIC_NUMBER: { public: true }, PRIVATE_TOKEN: {} });`
	);
	write(
		'src/routes/+server.js',
		`import { PUBLIC_NUMBER } from '$env/static/public'; import { env } from '$env/dynamic/private'; import { browser } from '$app/environment'; export function GET() { return Response.json({ number: PUBLIC_NUMBER, token: env.PRIVATE_TOKEN, browser }); }`
	);
	write(
		'src/routes/asset/+server.js',
		`import { asset } from '$app/paths'; export function GET() { return Response.json([asset('/a.png'), asset('a.png')]); }`
	);
	write(
		'src/client.js',
		`import { PRIVATE_TOKEN } from '$env/static/private'; export { PRIVATE_TOKEN };`
	);
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit(),
		server: { port: 0 },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	await server.listen();
	const address = server.httpServer!.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	origin = `http://localhost:${address.port}`;
}, 30_000);

afterAll(async () => {
	await server?.close();
	vi.restoreAllMocks();
	if (root) rmSync(root, { recursive: true, force: true });
});

test('retired modules resolve onto the app environment and stay server-only', async () => {
	const response = await fetch(origin + '/');
	expect(await response.json()).toEqual({ number: '7', token: 'secret', browser: false });
	expect(console.warn).toHaveBeenCalledWith(
		expect.stringContaining('[sveltekit] env_module_deprecated'),
		'font-weight: bold',
		'font-weight: normal'
	);
	const client = server.environments.client!;
	const { code } = (await client.transformRequest('/src/client.js'))!;
	const imported = /from "([^"]+)"/.exec(code)![1]!.replace('/@id/__x00__', '\0');
	await expect(client.transformRequest(imported)).rejects.toThrow(
		'Cannot import `$env/static/private` into code that runs in the browser'
	);
});

test('retired call forms of app functions are converted to current ones with a warning', async () => {
	const [retired, current] = await (await fetch(origin + '/asset')).json();
	expect(retired).toBe(current);
	expect(console.warn).toHaveBeenCalledWith(
		expect.stringContaining("`asset('/a.png')` should now be `asset('a.png')`"),
		'font-weight: bold',
		'font-weight: normal'
	);
});
