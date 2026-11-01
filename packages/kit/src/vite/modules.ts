import path from 'node:path';
import type { Plugin, Rolldown } from 'vite';
import { compileComponent, componentNames } from '../components/index.ts';
import { clientApp, clientNode } from './client.ts';
import {
	environmentConfig,
	environmentModule,
	legacyEnvironment,
	workerEnvironment
} from './env.ts';
import { clientDirectory, ids, virtualDirectory } from './ids.ts';
import * as e from './messages.ts';
import {
	fileUrl,
	importAliases,
	isServerOnly,
	normalizeId,
	packageImporter,
	moduleUrl,
	posix
} from './paths.ts';
import type { Project } from './project.ts';
import { errorTemplate, serverEntry, serverManifest, serverOptions } from './server.ts';

export function scanVirtualModules(): Rolldown.Plugin {
	return {
		name: 'kit:scan-virtual-modules',
		resolveId: {
			filter: {
				id: [
					/^\$app\//,
					/^\$env\//,
					/\/generated\/(?:dev|build)\/client\/nodes\//,
					new RegExp(virtualDirectory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				]
			},
			async handler(id, importer) {
				const resolved = await this.resolve(id, importer, { skipSelf: true });
				const target = resolved?.id ?? id;
				return { id: path.isAbsolute(target) ? fileUrl(target) : target, external: 'absolute' };
			}
		}
	};
}

export function virtualModules(getProject: () => Project): Plugin {
	return {
		name: 'kit:modules',
		enforce: 'pre',
		async resolveId(id, importer, options) {
			const project = getProject();
			if (id.startsWith('/@fs/')) id = id.slice(4);
			if (id.startsWith(virtualDirectory)) return path.posix.normalize(id);
			const nodes = clientDirectory(project) + '/nodes/';
			if (id.startsWith(nodes)) return path.posix.normalize(id);
			const url = moduleUrl(clientDirectory(project), project.root) + '/nodes/';
			if (id.startsWith(url)) return nodes + id.slice(url.length);
			if (id === '$app/manifest' || id === '<sveltekit:generated>/app-manifest.js')
				return ids.appManifest;
			if (id === '$app/env/public') return ids.publicEnv;
			if (id === '$app/env/private') return ids.privateEnv;
			if (/^\$env\/(static|dynamic)\/(public|private)$/.test(id))
				return `${virtualDirectory}${id.slice(1)}.js`;
			if (id.startsWith('$app/')) {
				const name = id.slice(5);
				return await this.resolve(`#app/${name}`, packageImporter, { ...options, skipSelf: true });
			}
			if (id === '$lib' || /^\$lib[/?]/.test(id) || /^\$service-worker(?:\?|$)/.test(id)) {
				const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
				if (resolved) return resolved;
				const name = id.startsWith('$lib') ? '$lib' : '$service-worker';
				if (name in project.config.alias || `${name}/*` in project.config.alias) return null;
				if (name === '$lib') e.module_removed_lib();
				e.module_removed_service_worker();
			}
			if (importer?.startsWith(virtualDirectory) && id.startsWith(project.name + '/')) {
				return await this.resolve(id, path.join(project.root, 'package.json'), {
					...options,
					skipSelf: true
				});
			}
			if (importer?.startsWith(virtualDirectory) && (id === 'vigla' || id.startsWith('vigla/'))) {
				return await this.resolve(id, packageImporter, { ...options, skipSelf: true });
			}
		},
		load(id) {
			const project = getProject();
			const { config, tree, root, name, format, environment } = project;
			const client = this.environment.config.consumer === 'client';
			const placeholders =
				project.vite.command === 'build' && this.environment.name !== 'serviceWorker';
			if (id === ids.appManifest)
				return `export const immutable = ${placeholders ? '__SVELTEKIT_MANIFEST_IMMUTABLE__' : JSON.stringify(project.build?.manifest.immutable ?? [])}, prerendered = ${placeholders ? '__SVELTEKIT_MANIFEST_PRERENDERED__' : JSON.stringify(project.build?.manifest.prerendered ?? [])}; export const assets = ${JSON.stringify(tree.assets.map((asset) => ({ path: asset.file })))}; export const routes = ${JSON.stringify(tree.routes.filter((route) => route.page || route.endpoint).map((route) => ({ id: route.id, page: !!route.page, endpoint: !!route.endpoint })))};`;
			if (id === ids.bootstrap)
				return `import { init } from ${JSON.stringify(name + '/internal/payload')}; init(globalThis[${JSON.stringify(project.global)}]);`;
			if (id === ids.client) return clientApp(project);
			if (id === ids.bundle)
				return `import ${JSON.stringify(ids.bootstrap)}; import { init, start as boot } from ${JSON.stringify(name + '/internal/client')}; import * as app from ${JSON.stringify(ids.client)}; export { init }; export const decode = app.decode; export function start(target,hydrate) { return boot(app,target,hydrate); }`;
			if (id === ids.server) return serverEntry(name, project.vite.command === 'serve');
			if (id === ids.manifest) return serverManifest(project);
			if (id === ids.options) return serverOptions(project);
			if (id === ids.errorTemplate) return errorTemplate(config);
			if (id === ids.env)
				return environmentConfig(environment, name, project.vite.command === 'serve');
			if (id === ids.workerEnv)
				return workerEnvironment(environment, config, name, project.vite.command === 'serve');
			if (id === ids.publicEnv)
				return environmentModule(environment, 'public', client, project.vite.command === 'serve');
			if (id === ids.privateEnv)
				return environmentModule(environment, 'private', false, project.vite.command === 'serve');
			const legacy = /^env\/(static|dynamic)\/(public|private)\.js$/.exec(
				id.slice(virtualDirectory.length)
			);
			if (id.startsWith(virtualDirectory) && legacy)
				return legacyEnvironment(
					legacy[2] as 'public' | 'private',
					legacy[1] === 'dynamic',
					name,
					project.vite.command === 'serve'
				);
			const nodes = clientDirectory(project) + '/nodes/';
			const node = /^(\d+)\.js$/.exec(id.slice(nodes.length));
			if (id.startsWith(nodes) && node) {
				const index = Number(node[1]);
				const value = tree.nodes[index];
				if (!value) throw new Error(`Unknown client node ${index}`);
				return clientNode(value, index, root);
			}
			for (const name of componentNames) {
				if (id !== ids[name]) continue;
				const compiled = compileComponent(name, {
					generate: client ? 'client' : 'server',
					dev: project.vite.command === 'serve',
					format
				});
				return { code: compiled.code, map: JSON.stringify(compiled.map) };
			}
		},
		transform(code, id) {
			const project = getProject();
			if (
				this.environment.config.consumer === 'client' &&
				id.split('?')[0] === project.serviceWorker
			)
				return { code: `import ${JSON.stringify(ids.workerEnv)};\n${code}`, map: null };
		}
	};
}

export function serverGuard(getProject: () => Project): Plugin {
	const importers = new Map<string, Set<string>>();
	const special = new Map<string, string>();
	function chain(id: string, seen = new Set<string>()): string[] {
		if (seen.has(id)) return [];
		seen.add(id);
		for (const parent of importers.get(id) ?? []) {
			if (seen.has(parent)) continue;
			return [...chain(parent, seen), parent];
		}
		return [];
	}
	return {
		name: 'kit:server-only',
		enforce: 'pre',
		applyToEnvironment(environment) {
			return environment.config.consumer === 'client';
		},
		async resolveId(id, importer, options) {
			if (!importer || importer.endsWith('/index.html')) return;
			const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
			if (!resolved) return;
			const file = posix(resolved.id.split('?')[0]!);
			const parents = importers.get(file) ?? new Set<string>();
			parents.add(posix(importer.split('?')[0]!));
			importers.set(file, parents);
			if (id === '$app/server' || id === '$app/env/private' || /^\$env\/.*\/private$/.test(id))
				special.set(file, id);
		},
		load(id) {
			const project = getProject();
			id = posix(id.split('?')[0]!);
			const alias = importAliases(project.root);
			const pretty = (file: string) => special.get(file) ?? normalizeId(file, alias, project.root);
			const legacyPrivate =
				id.startsWith(virtualDirectory) &&
				/^env\/(static|dynamic)\/private\.js$/.test(id.slice(virtualDirectory.length));
			if (
				special.has(id) ||
				legacyPrivate ||
				id === ids.privateEnv ||
				id === ids.env ||
				isServerOnly(id, {
					root: posix(project.root),
					node_modules: posix(path.join(project.root, 'node_modules')),
					routes: posix(project.config.files.routes),
					assets: posix(project.config.files.assets)
				})
			) {
				const names = [...chain(id), id]
					.filter((file) => !file.startsWith(virtualDirectory) || file === id)
					.map(pretty);
				e.server_only_import({
					module: id === ids.privateEnv ? '$app/env/private' : pretty(id),
					chain: names.map((name, index) => `${' '.repeat(index + 1)}${name}`).join(' imports\n')
				});
			}
		},
		buildEnd() {
			importers.clear();
			special.clear();
		}
	};
}
