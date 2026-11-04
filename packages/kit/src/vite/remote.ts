import path from 'node:path';
import type { Plugin, Rolldown, ViteDevServer } from 'vite';
import type { RemoteMetadata } from '../build/index.ts';
import { hash } from '../shared/hash.ts';
import type { Identity } from '../types/identity.ts';
import type { RemoteExport, RemoteInternals } from '../types/internal/remote.ts';
import { isRunnable } from '../sync/index.ts';
import { fileUrl, isRemoteModule, posix, remotePattern } from './paths.ts';
import { ViteMessages } from './messages.ts';
import type { Project } from './project.ts';

export interface RemoteEntry {
	file: string;
	chunk?: string;
}

export interface RemoteIntegration {
	plugins: Plugin[];
	scan: Rolldown.Plugin;
	entries: ReadonlyMap<string, RemoteEntry>;
}

const prefix = '\0kit:remote:';
const kinds = new Set(['query', 'query_batch', 'query_live', 'command', 'form', 'prerender']);

export function createRemotePlugin(
	getProject: () => Project,
	identity: Identity
): RemoteIntegration {
	const isRemote = (id: string) => isRemoteModule(id, identity.packages);
	const entries = new Map<string, RemoteEntry>();
	const references = new Map<string, string>();
	let server: ViteDevServer | undefined;

	const scan: Rolldown.Plugin = {
		name: 'kit:scan-remotes',
		resolveId: {
			filter: { id: remotePattern },
			async handler(id, importer) {
				const resolved = await this.resolve(id, importer, { skipSelf: true });
				if (!resolved) return { id, external: true };
				if (!isRemote(resolved.id)) return;
				return { id: fileUrl(resolved.id), external: 'absolute' };
			}
		}
	};

	const plugin: Plugin = {
		name: 'kit:remote',
		configureServer(dev) {
			server = dev;
		},
		applyToEnvironment(environment) {
			return environment.name !== 'serviceWorker';
		},
		perEnvironmentStartEndDuringDev: true,
		buildStart() {
			if (this.environment.config.consumer === 'server' && !server) {
				entries.clear();
				references.clear();
			}
		},
		resolveId(id) {
			if (id.startsWith(prefix)) return id;
		},
		load(id) {
			if (!id.startsWith(prefix)) return;
			const entry = entries.get(id.slice(prefix.length));
			if (!entry) throw new Error(`Unknown remote entry: ${id.slice(prefix.length)}`);
			return `import * as functions from ${JSON.stringify(entry.file)}; export default functions;`;
		},
		async transform(code, id) {
			if (!isRemote(id)) return;
			const project = getProject();
			if (!project.config.experimental.remoteFunctions)
				new ViteMessages(project.diagnostics).config_feature_disabled({
					feature: 'remote functions',
					keypath: 'experimental.remoteFunctions',
					value: 'true'
				});
			const file = posix(path.relative(project.root, id));
			const key = hash(file);
			if (this.environment.config.consumer === 'server') {
				const existing = entries.get(key);
				if (existing && existing.file !== id)
					throw new Error(`Remote hash collision: ${id} and ${existing.file}`);
				if (!existing) entries.set(key, { file: id });
				if (!server && !references.has(key)) {
					const reference = this.emitFile({
						type: 'chunk',
						id: prefix + key,
						name: `remote-${key}`
					});
					references.set(key, reference);
				}
				let self = '$$kit_remote_self';
				let init = '$$kit_init_remote';
				while (code.includes(self)) self += '$';
				while (code.includes(init)) init += '$';
				return {
					code: `${code}\n\nimport * as ${self} from ${JSON.stringify(id)};\nimport { initRemote as ${init} } from ${JSON.stringify(`${project.name}/internal/server`)};\n${server ? 'await Promise.resolve();\n' : ''}for (const [name, value] of Object.entries(${self})) ${init}(value, ${JSON.stringify(key + '/')} + name);\n`,
					map: null
				};
			}
			let exports: Iterable<[string, RemoteInternals | RemoteMetadata]>;
			if (server) {
				const environment = server.environments.ssr;
				if (!isRunnable(environment)) throw new Error('The Vite SSR environment is not runnable');
				const module = (await environment.runner.import(id)) as Record<string, RemoteExport>;
				exports = Object.entries(module).map(([name, value]) => [name, value.__]);
			} else {
				const metadata = project.build?.analysis.remotes.get(key);
				if (!metadata) throw new Error(`Missing remote analysis for ${file}`);
				exports = metadata;
			}
			const declarations: string[] = [];
			let index = 0;
			for (const [name, info] of exports) {
				if (!info || !kinds.has(info.type))
					new ViteMessages(project.diagnostics).remote_module_invalid_export({ name, file });
				const local = `$$remote_${index++}`;
				declarations.push(
					`const ${local} = remote.${info.type}(${JSON.stringify(key + '/' + name)}); export { ${local} as ${JSON.stringify(name)} };`
				);
			}
			return {
				code: `import * as remote from ${JSON.stringify(`${project.name}/internal/client`)};\n${declarations.join('\n')}\n${server ? 'import.meta.hot?.accept();\n' : ''}`,
				map: null
			};
		},
		generateBundle() {
			if (this.environment.config.consumer !== 'server') return;
			for (const [key, reference] of references)
				entries.get(key)!.chunk = this.getFileName(reference);
		}
	};
	return { plugins: [plugin], scan, entries };
}
