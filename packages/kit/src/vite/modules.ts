import path from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { compileComponent, componentNames } from '../components/index.ts';
import { clientApp, clientNode } from './client.ts';
import {
	environmentConfig,
	environmentModule,
	legacyEnvironment,
	workerEnvironment
} from './env.ts';
import { ids, virtualDirectory } from './ids.ts';
import * as e from './messages.ts';
import { importAliases, isServerOnly, normalizeId, packageImporter, posix } from './paths.ts';
import type { Project } from './project.ts';
import { errorTemplate, serverEntry, serverManifest, serverOptions } from './server.ts';

export function virtualModules(getProject: () => Project): Plugin {
	return {
		name: 'kit:modules',
		enforce: 'pre',
		async resolveId(id, importer, options) {
			const project = getProject();
			if (id.startsWith('/@fs/')) id = id.slice(4);
			if (id.startsWith(virtualDirectory)) return path.posix.normalize(id);
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
			if (id === ids.appManifest)
				return `export const immutable = [], prerendered = []; export const assets = ${JSON.stringify(tree.assets.map((asset) => ({ path: asset.file })))}; export const routes = ${JSON.stringify(tree.routes.filter((route) => route.page || route.endpoint).map((route) => ({ id: route.id, page: !!route.page, endpoint: !!route.endpoint })))};`;
			if (id === ids.client) return clientApp(config, tree, root, format);
			if (id === ids.server) return serverEntry(name);
			if (id === ids.manifest) return serverManifest(config, tree, root);
			if (id === ids.options) return serverOptions(config, tree, root, format);
			if (id === ids.errorTemplate) return errorTemplate(config);
			if (id === ids.env) return environmentConfig(environment, name);
			if (id === ids.workerEnv) return workerEnvironment(environment, config, name);
			if (id === ids.publicEnv) return environmentModule(environment, 'public', client);
			if (id === ids.privateEnv) return environmentModule(environment, 'private', false);
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
			const node = /^client\/nodes\/(\d+)\.js$/.exec(id.slice(virtualDirectory.length));
			if (id.startsWith(virtualDirectory) && node) {
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
					root: normalizePath(project.root),
					node_modules: normalizePath(path.join(project.root, 'node_modules')),
					routes: normalizePath(project.config.files.routes),
					assets: normalizePath(project.config.files.assets)
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
