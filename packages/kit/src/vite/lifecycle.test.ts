import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import type { ViteDevServer } from 'vite';
import { importVite } from '../config/file.ts';
import { packageDirectory } from './paths.ts';

let root: string;
let server: ViteDevServer | undefined;
const require = createRequire(import.meta.url);

beforeAll(() => {
	vi.stubEnv('MY_CUSTOM_PORT', undefined);
	vi.stubEnv('INSTRUMENTATION_ENV', undefined);
	root = mkdtempSync(path.join(import.meta.dirname, '.test-lifecycle-'));
	const write = (file: string, contents: string) => {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, contents);
	};
	write('package.json', '{"type":"module","dependencies":{"@sveltejs/kit":"workspace:*"}}');
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	write(
		'vite.config.js',
		`import { sveltekit } from '@sveltejs/kit/vite';
		export default { plugins: [sveltekit()], test: { include: ['runtime.test.js'] } };`
	);
	write('src/app.html', '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>');
	write(
		'src/env.js',
		`import { defineEnvVars } from '@sveltejs/kit/env';
		export const variables = defineEnvVars({ MY_CUSTOM_PORT: {}, INSTRUMENTATION_ENV: {} });`
	);
	write(
		'handler.js',
		`const { MY_CUSTOM_PORT, INSTRUMENTATION_ENV } = process.env;
		export const handler = () => Response.json({ port: MY_CUSTOM_PORT, instrumentation: INSTRUMENTATION_ENV });`
	);
	write(
		'runtime.test.js',
		`import { expect, test, vi } from 'vitest';
		test('imports the runtime after supplying its environment', async () => {
			vi.stubEnv('MY_CUSTOM_PORT', '1234');
			vi.stubEnv('INSTRUMENTATION_ENV', 'available');
			try {
				const { handler } = await import('./handler.js');
				expect(await handler().json()).toEqual({ port: '1234', instrumentation: 'available' });
			} finally { vi.unstubAllEnvs(); }
		});`
	);
	write(
		'src/hooks.server.js',
		`import { MY_CUSTOM_PORT, INSTRUMENTATION_ENV } from '$app/env/private';
		const startup = MY_CUSTOM_PORT + ':' + INSTRUMENTATION_ENV;
		export async function handle({ event, resolve }) {
			const response = await resolve(event);
			response.headers.set('x-startup-env', startup);
			return response;
		}`
	);
	write(
		'src/routes/+server.js',
		`import { MY_CUSTOM_PORT, INSTRUMENTATION_ENV } from '$app/env/private';
		export function GET() { return Response.json({ port: MY_CUSTOM_PORT, instrumentation: INSTRUMENTATION_ENV }); }`
	);
});

afterAll(async () => {
	await server?.close();
	vi.unstubAllEnvs();
	if (root) rmSync(root, { recursive: true, force: true });
});

test('Vitest loads the public Vite config before tests supply runtime environment values', async () => {
	const cli = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
	const report = path.join(root, 'report.json');
	await promisify(execFile)(
		process.execPath,
		[cli, 'run', '--root', root, '--maxWorkers', '1', '--reporter', 'json', '--outputFile', report],
		{ cwd: root, timeout: 20_000 }
	);
	expect(JSON.parse(readFileSync(report, 'utf8'))).toMatchObject({
		numTotalTests: 1,
		numPassedTests: 1,
		numFailedTests: 0
	});
}, 30_000);

test('a real dev request validates current values before importing application hooks', async () => {
	const vite = await importVite(root);
	server = await vite.createServer({
		root,
		logLevel: 'silent',
		server: { host: '127.0.0.1', port: 0 },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	await server.listen();
	const address = server.httpServer!.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	const origin = `http://127.0.0.1:${address.port}`;
	const invalid = await fetch(origin);
	expect(invalid.status).toBe(500);
	const failure = await invalid.text();
	expect(failure).toContain('env_invalid');
	expect(failure).toContain('MY_CUSTOM_PORT');
	expect(failure).toContain('INSTRUMENTATION_ENV');
	vi.stubEnv('MY_CUSTOM_PORT', '4321');
	vi.stubEnv('INSTRUMENTATION_ENV', 'ready');
	const valid = await fetch(origin);
	expect(valid.status, await valid.clone().text()).toBe(200);
	expect(valid.headers.get('x-startup-env')).toBe('4321:ready');
	expect(await valid.json()).toEqual({ port: '4321', instrumentation: 'ready' });
}, 30_000);
