import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { identity } from '../identity.ts';
import { diagnosticText, throwDiagnostic, warningSource } from './diagnostics.ts';

const prefix = `\0${identity.name}:`;
const docs = 'https://svelte.dev/docs/kit/';
const legacyEnvironment = /^\$env\/(static|dynamic)\/(public|private)$/;
const extension = path.extname(fileURLToPath(import.meta.url));
const wrapped = new Map(
	['navigation', 'paths', 'forms'].map((name) => [
		`$app/${name}`,
		fileURLToPath(new URL(`./app/${name}${extension}`, import.meta.url))
	])
);

function removedModule(id: string, aliases: Record<string, string>): void {
	const name = id.startsWith('$lib') ? '$lib' : '$service-worker';
	if (name in aliases || `${name}/*` in aliases) return;
	if (name === '$lib')
		throwDiagnostic(
			'module_removed_lib',
			`\`$lib\` has been removed. Use \`#lib\` instead: ${docs}$lib. To keep using \`$lib\`, add \`alias: { '$lib': 'src/lib' }\` to your ${identity.product} config.`,
			removedModule
		);
	throwDiagnostic(
		'module_removed_service_worker',
		`\`$service-worker\` has been removed. Use \`immutable\`, \`assets\` and \`prerendered\` from \`$app/manifest\`, \`version\` from \`$app/env\`, and \`resolve(...)\` from \`$app/paths\` instead: ${docs}$service-worker`,
		removedModule
	);
}

function stores(dev: boolean): string {
	const message = dev
		? diagnosticText(
				'app_stores_removed',
				'`$app/stores` has been removed in favour of `$app/state`'
			)
		: `${identity.diagnostics}app_stores_removed`;
	return `function removed() { const error = new Error(${JSON.stringify(message)}); ${dev ? `error.name = ${JSON.stringify(`${identity.product} error`)}; ` : ''}throw error; }
export const getStores = removed;
export const page = { subscribe: removed };
export const navigating = { subscribe: removed };
export const updated = { subscribe: removed, check: removed };`;
}

function environment(dev: boolean, client: boolean): string {
	const warning =
		dev && client
			? warningSource(
					'app_environment_deprecated',
					'`$app/environment` is deprecated, use `$app/env` instead'
				)
			: '';
	return `export { browser, dev, building, version } from '$app/env';\n${warning}`;
}

function legacy(kind: string, visibility: string, dev: boolean): string {
	const target = `$app/env/${visibility}`;
	const exports =
		kind === 'dynamic'
			? `import * as env from ${JSON.stringify(target)}; export { env };`
			: `export * from ${JSON.stringify(target)};`;
	const warning = dev
		? warningSource(
				'env_module_deprecated',
				`\`$env/${kind}/${visibility}\` is deprecated, use \`${target}\` instead`
			)
		: '';
	return `${exports}\n${warning}`;
}

export function appModules(): Plugin {
	return {
		name: `${identity.name}:history-app`,
		enforce: 'pre',
		resolveId(id, importer) {
			const wrapper = wrapped.get(id);
			if (wrapper && importer?.split('?')[0] !== wrapper) return wrapper;
		}
	};
}

export function history(config: { alias?: Record<string, string> } = {}): Plugin {
	let dev = false;
	return {
		name: `${identity.name}:history`,
		config(user, env) {
			dev = env.command === 'serve';
			const root = path.resolve(user.root ?? process.cwd());
			for (const file of ['svelte.config.js', 'svelte.config.ts'])
				if (existsSync(path.join(root, file)))
					throwDiagnostic(
						'config_file_unsupported',
						`\`${file}\` is no longer used. Please pass configuration via the \`${identity.plugin}(...)\` plugin in your Vite config.`,
						history
					);
			return {
				optimizeDeps: {
					rolldownOptions: {
						plugins: [
							{
								name: `${identity.name}:scan-history`,
								resolveId: {
									filter: { id: /^\$env\// },
									handler: (id) => ({ id, external: true })
								}
							}
						]
					}
				}
			};
		},
		async resolveId(id, importer, options) {
			if (id === '$app/environment' || id === '$app/stores') return prefix + id.slice(1);
			if (legacyEnvironment.test(id)) return prefix + id.slice(1);
			if (id === '$lib' || /^\$lib[/?]/.test(id) || /^\$service-worker(?:\?|$)/.test(id)) {
				const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
				if (resolved) return resolved;
				removedModule(id, config.alias ?? {});
			}
		},
		load(id) {
			if (!id.startsWith(prefix)) return;
			const name = id.slice(prefix.length);
			const client = this.environment.config.consumer === 'client';
			if (name === 'app/stores') return stores(dev);
			if (name === 'app/environment') return environment(dev, client);
			const match = /^env\/(static|dynamic)\/(public|private)$/.exec(name);
			if (match) return legacy(match[1]!, match[2]!, dev);
		}
	};
}
