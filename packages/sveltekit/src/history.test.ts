import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { sveltekit } from './vite.ts';

const facade = fileURLToPath(new URL('..', import.meta.url));
const handleError = `export function handleError(input) { return { message: [input.kind, input.status, input.message, Object.keys(input).join('|')].join(',') }; }`;

interface Fixture {
	root: string;
	server: ViteDevServer;
	origin: string;
	close(): Promise<void>;
}

async function fixture(
	files: Record<string, string>,
	config: Parameters<typeof sveltekit>[0] = {}
): Promise<Fixture> {
	const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'sveltekit-history-')));
	const all: Record<string, string> = {
		'package.json':
			'{"name":"history-fixture","type":"module","dependencies":{"@sveltejs/kit":"*"}}',
		'src/app.html': '<html><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>',
		'src/routes/fail/+server.js': `export function GET() { throw new Error('boom'); }`,
		...files
	};
	for (const [file, content] of Object.entries(all)) {
		const destination = path.join(root, file);
		mkdirSync(path.dirname(destination), { recursive: true });
		writeFileSync(destination, content);
	}
	mkdirSync(path.join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(facade, path.join(root, 'node_modules/@sveltejs/kit'), 'dir');
	symlinkSync(
		realpathSync(path.join(facade, 'node_modules/vite')),
		path.join(root, 'node_modules/vite'),
		'dir'
	);
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: await sveltekit(config),
		server: { port: 0 },
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	await server.listen();
	const address = server.httpServer!.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	return {
		root,
		server,
		origin: `http://localhost:${address.port}`,
		async close() {
			await server.close();
			rmSync(root, { recursive: true, force: true });
		}
	};
}

async function failure(origin: string): Promise<string> {
	const response = await fetch(origin + '/fail', { headers: { accept: 'application/json' } });
	expect(response.status).toBe(500);
	return (await response.json()).message;
}

let app: Fixture;

beforeAll(async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	app = await fixture({
		'.env': 'PUBLIC_NUMBER=7\nPRIVATE_TOKEN=secret\n',
		'src/env.ts': `import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ PUBLIC_NUMBER: { public: true }, PRIVATE_TOKEN: {} });`,
		'src/routes/+server.js': `import { PUBLIC_NUMBER } from '$env/static/public'; import { env } from '$env/dynamic/private'; import { browser } from '$app/environment'; export function GET() { return Response.json({ number: PUBLIC_NUMBER, token: env.PRIVATE_TOKEN, browser }); }`,
		'src/hooks.server.js': handleError,
		'src/routes/asset/+server.js': `import { asset } from '$app/paths'; export function GET() { return Response.json([asset('/a.png'), asset('a.png')]); }`,
		'src/client.js': `import { PRIVATE_TOKEN } from '$env/static/private'; export { PRIVATE_TOKEN };`
	});
}, 30_000);

afterAll(async () => {
	await app?.close();
	vi.restoreAllMocks();
});

test('retired modules resolve onto the app environment and stay server-only', async () => {
	const response = await fetch(app.origin + '/');
	expect(await response.json()).toEqual({ number: '7', token: 'secret', browser: false });
	expect(console.warn).toHaveBeenCalledWith(
		expect.stringContaining('[sveltekit] env_module_deprecated'),
		'font-weight: bold',
		'font-weight: normal'
	);
	const client = app.server.environments.client!;
	const { code } = (await client.transformRequest('/src/client.js'))!;
	const imported = /from "([^"]+)"/.exec(code)![1]!.replace('/@id/__x00__', '\0');
	await expect(client.transformRequest(imported)).rejects.toThrow(
		'Cannot import `$env/static/private` into code that runs in the browser'
	);
});

test("handleError's input keeps the retired status and message as warning, non-enumerable accessors", async () => {
	expect(await failure(app.origin)).toBe('unknown,500,Internal Error,kind|error|event');
	for (const code of ['handle_error_status_deprecated', 'handle_error_message_deprecated'])
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining(`[sveltekit] ${code}`),
			'font-weight: bold',
			'font-weight: normal'
		);
});

test.each([
	[
		'an explicit extension',
		'source/hooks.server.js',
		{ hooks: { server: 'source/hooks.server.js' } }
	],
	['a directory index', 'src/hooks.server/index.js', undefined]
])(
	"handleError's retired accessors follow a hook file with %s",
	async (_, file, files) => {
		const layout = await fixture({ [file]: handleError }, files ? { files } : {});
		try {
			expect(await failure(layout.origin)).toBe('unknown,500,Internal Error,kind|error|event');
		} finally {
			await layout.close();
		}
	},
	30_000
);

test('retired call forms of app functions are converted to current ones with a warning', async () => {
	const [retired, current] = await (await fetch(app.origin + '/asset')).json();
	expect(retired).toBe(current);
	expect(console.warn).toHaveBeenCalledWith(
		expect.stringContaining("`asset('/a.png')` should now be `asset('a.png')`"),
		'font-weight: bold',
		'font-weight: normal'
	);
});
