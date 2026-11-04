import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import {
	build,
	createServer,
	optimizeDeps,
	resolveConfig,
	type Rolldown,
	type ViteDevServer
} from 'vite';
import { hash } from '../shared/hash.ts';
import type { Project } from './project.ts';
import { packageDirectory } from './paths.ts';
import { createRemotePlugin } from './remote.ts';
import { own } from '../shared/identity.ts';

const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'kit-remote-')));
const remoteFile = path.join(root, 'items.remote.js');
const key = hash('items.remote.js');
const runtime = path.join(root, 'runtime.js');
const entry = path.join(root, 'entry.js');
writeFileSync(
	remoteFile,
	`const secret = 'server secret'; const query = Object.assign(() => secret, { __: { type: 'query' } }); const form = Object.assign(() => secret, { __: { type: 'form' } }); export { query as load, form as default };`
);
writeFileSync(
	runtime,
	`export function initRemote(value, id) { value.__.id = id; value.__.name = id.slice(id.indexOf('/') + 1); }`
);
writeFileSync(entry, `import { load } from './items.remote.js'; export { load };`);
const aliases = [
	{ find: '@vigla/kit/internal/server', replacement: runtime },
	{ find: '@vigla/kit/internal/client', replacement: runtime }
];
const servers: ViteDevServer[] = [];
afterAll(async () => {
	await Promise.all(servers.map((server) => server.close()));
	rmSync(root, { recursive: true, force: true });
});

test('dev registers server exports and exposes only remote stubs to clients', async () => {
	const project = {
		root,
		name: '@vigla/kit',
		identity: own,
		config: { experimental: { remoteFunctions: true } }
	} as Project;
	const remote = createRemotePlugin(() => project, own);
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: remote.plugins,
		resolve: { alias: aliases },
		server: { middlewareMode: true },
		optimizeDeps: { noDiscovery: true }
	});
	servers.push(server);
	const client = await server.environments.client!.transformRequest('/items.remote.js');
	expect(client!.code).not.toContain('server secret');
	expect(client!.code).toContain(`remote.query("${key}/load")`);
	expect(client!.code).toContain(`remote.form("${key}/default")`);
	const loaded = await server.ssrLoadModule(remoteFile);
	expect(loaded.load.__).toEqual({ type: 'query', id: `${key}/load`, name: 'load' });
	expect(loaded.default.__.id).toBe(`${key}/default`);
	expect(remote.entries.get(key)?.file).toBe(remoteFile);
});

test('server builds publish remote chunks and client builds use analysed kinds', async () => {
	const project = {
		root,
		name: '@vigla/kit',
		config: { experimental: { remoteFunctions: true } },
		build: {
			analysis: {
				remotes: new Map([
					[
						key,
						new Map([
							['load', { type: 'query', dynamic: true }],
							['default', { type: 'form', dynamic: true }]
						])
					]
				])
			}
		}
	} as unknown as Project;
	const remote = createRemotePlugin(() => project, own);
	const result = (await build({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: remote.plugins,
		resolve: { alias: aliases },
		build: { ssr: entry, write: false, minify: false }
	})) as Rolldown.RolldownOutput;
	const chunk = remote.entries.get(key)?.chunk;
	expect(chunk).toBeDefined();
	expect(result.output.some((output) => output.type === 'chunk' && output.fileName === chunk)).toBe(
		true
	);
	const client = (await build({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: remote.plugins,
		build: {
			write: false,
			minify: false,
			rolldownOptions: { input: remoteFile, external: ['@vigla/kit/internal/client'] }
		}
	})) as Rolldown.RolldownOutput;
	const code = client.output
		.filter((output) => output.type === 'chunk')
		.map((output) => output.code)
		.join('\n');
	expect(code).toContain(`${key}/load`);
	expect(code).toContain(`${key}/default`);
	expect(code).not.toContain('server secret');
});

test('Kit runtime modules are not treated as app remote functions', async () => {
	const remote = createRemotePlugin(() => ({ root, name: '@vigla/kit' }) as Project, own);
	const result = (await build({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins: remote.plugins,
		resolve: { alias: aliases },
		build: { ssr: path.join(packageDirectory, 'src/shared/remote.ts'), write: false, minify: false }
	})) as Rolldown.RolldownOutput;
	const chunk = result.output.find(
		(output) =>
			output.type === 'chunk' &&
			output.facadeModuleId === path.join(packageDirectory, 'src/shared/remote.ts')
	);
	expect(chunk?.type === 'chunk' && chunk.exports).toContain('encodeArgument');
	expect([...remote.entries]).toEqual([]);
});

test('dependency optimization externalizes remote modules', async () => {
	const directory = path.join(root, 'node_modules', 'remote-package');
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		path.join(directory, 'package.json'),
		JSON.stringify({
			name: 'remote-package',
			version: '1.0.0',
			type: 'module',
			main: 'index.js',
			peerDependencies: { '@vigla/kit': '*' }
		})
	);
	writeFileSync(path.join(directory, 'index.js'), `export { load } from './data.remote.js';`);
	writeFileSync(
		path.join(directory, 'data.remote.js'),
		`import 'server-only-secret'; export const load = 'server secret';`
	);
	const remote = createRemotePlugin(() => ({ root, name: '@vigla/kit' }) as Project, own);
	const config = await resolveConfig(
		{
			root,
			configFile: false,
			logLevel: 'silent',
			optimizeDeps: { include: ['remote-package'], rolldownOptions: { plugins: [remote.scan] } }
		},
		'serve'
	);
	const result = await optimizeDeps(config, true);
	const code = readFileSync(result.optimized['remote-package']!.file, 'utf8');
	expect(code).toContain(`/@fs${path.join(directory, 'data.remote.js')}`);
	expect(code).not.toContain('server-only-secret');
});
