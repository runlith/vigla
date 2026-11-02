import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, expect, test, vi } from 'vitest';
import type { RequestStore, ServerManifest, ServerOptions } from '../types/internal/server.ts';
import { walk } from '../build/index.ts';
import { importVite } from '../config/file.ts';
import { packageDirectory } from './paths.ts';
import type { Project } from './project.ts';
import { createRemotePlugin } from './remote.ts';
import { pruneRemotes } from './remote-build.ts';

const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'kit-remote-build-')));
afterAll(() => {
	vi.unstubAllGlobals();
	rmSync(root, { recursive: true, force: true });
});

test('the postbuild removes non-dynamic implementations across colliding namespaces and keeps dynamic functions', async () => {
	mkdirSync(path.join(root, 'node_modules/@vigla'), { recursive: true });
	symlinkSync(packageDirectory, path.join(root, 'node_modules/@vigla/kit'), 'dir');
	writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
	for (const folder of ['one', 'two']) {
		mkdirSync(path.join(root, folder));
		writeFileSync(
			path.join(root, folder, 'data.remote.js'),
			`
import { prerender } from ${JSON.stringify(path.join(packageDirectory, 'src/entries/app/server/server.ts'))};
const read = prerender(() => ${JSON.stringify('server-only-' + folder)});
export { read as saved };
export const live = prerender(() => 'dynamic ${folder}', { dynamic: true });
`
		);
	}
	const entry = path.join(root, 'entry.js');
	writeFileSync(
		entry,
		`
export { Server, handleRemote } from '@vigla/kit/internal/server';
export { saved as one, live } from './one/data.remote.js';
export { saved as two } from './two/data.remote.js';
`
	);
	const api = await importVite(packageDirectory);
	const project = { root, name: '@vigla/kit', api } as Project;
	const remote = createRemotePlugin(() => project);
	const directory = path.join(root, 'output/server');
	await api.build({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: remote.plugins,
		ssr: { noExternal: ['@vigla/kit', 'vigla', 'devalue', 'cookie', 'esm-env'] },
		build: {
			ssr: entry,
			outDir: directory,
			minify: false,
			sourcemap: true,
			rolldownOptions: { output: { entryFileNames: 'entry.js' } }
		}
	});
	const remotes = Object.fromEntries([...remote.entries].map(([id, entry]) => [id, entry.chunk!]));
	project.build = {
		config: { outDir: root },
		artifacts: { remotes },
		analysis: {
			remotes: new Map(
				[...remote.entries.keys()].map((id) => [
					id,
					new Map([
						['saved', { type: 'prerender', dynamic: false }],
						['live', { type: 'prerender', dynamic: true }]
					])
				])
			)
		}
	} as Project['build'];
	project.vite = { build: { sourcemap: true }, environments: {} } as Project['vite'];
	await pruneRemotes(project);
	const code = walk(directory)
		.filter((file) => file.endsWith('.js'))
		.map((file) => readFileSync(path.join(directory, file), 'utf8'))
		.join('\n');
	expect(code).not.toContain('server-only-one');
	expect(code).not.toContain('server-only-two');
	const maps = walk(directory)
		.filter((file) => file.endsWith('.map'))
		.map((file) => readFileSync(path.join(directory, file), 'utf8'))
		.join('\n');
	expect(maps).toContain('server-only-one');
	expect(maps).toContain('server-only-two');

	const { Server, handleRemote, one, two, live } = await import(
		pathToFileURL(path.join(directory, 'entry.js')).href
	);
	const manifest: ServerManifest = {
		app_dir: '_app',
		app_path: 'base/_app',
		assets: new Set(),
		mime_types: {},
		client: null,
		nodes: [
			async () => ({
				index: 0,
				imports: [],
				stylesheets: [],
				fonts: [],
				component: async () => () => {},
				server: { load: async () => ({ one: await one(), two: await two(), live: await live() }) }
			})
		],
		remotes: {},
		routes: [
			{
				id: '/',
				pattern: /^\/$/,
				params: [],
				page: { layouts: [], errors: [], leaf: 0 },
				endpoint: null
			}
		],
		prerendered_routes: new Set(),
		server_assets: {},
		matchers: async () => ({})
	};
	const options: ServerOptions = {
		global: '__remote_build',
		root: (out, props) => out.push(JSON.stringify(props.tree.data)),
		getHooks: async () => ({
			handleError: ({ error }) => ({ status: 500, message: String(error) })
		}),
		templates: { app: ({ body }) => body, error: ({ message }) => message },
		appTemplateContainsNonce: false,
		csp: {},
		csrf: { checkOrigin: true, trustedOrigins: [] },
		paths: { base: '/base', assets: '', relative: false },
		env: { set: () => ({ public: {}, private: {}, rendered: {} }) },
		serviceWorker: null,
		version: { name: 'test', pollInterval: 0 },
		output: { preloadStrategy: 'modulepreload', bundleStrategy: 'split', linkHeaderPreload: false },
		router: { type: 'pathname', resolution: 'client' },
		embedded: false,
		tracing: { server: false },
		dev: false,
		building: false,
		prerendering: false,
		remote: handleRemote
	};
	let available = true;
	const paths = new Set(
		Object.keys(remotes).map((id) => `https://app.test/base/_app/remote/${id}/saved`)
	);
	vi.stubGlobal('fetch', async (input: URL | RequestInfo, init?: RequestInit) => {
		if (init?.redirect !== 'manual') return new Response(null, { status: 403 });
		return available && paths.has(String(input))
			? Response.json({ type: 'result', data: '[{"_":1},"stored"]' })
			: new Response(null, { status: 404 });
	});
	const server = new Server(manifest, options);
	await server.init({ env: {}, scope: new AsyncLocalStorage<RequestStore>() });
	const address = { getClientAddress: () => '192.0.2.1' };
	const response = await server.respond(new Request('https://app.test/base/'), address);
	expect(response.status).toBe(200);
	const html = await response.text();
	expect(html).toContain('{"one":"stored","two":"stored","live":"dynamic one"}');
	available = false;
	const failed = await server.respond(new Request('https://app.test/base/'), address);
	expect(failed.status).toBe(500);
	expect(await failed.text()).toContain('remote_prerender_not_dynamic');
});
