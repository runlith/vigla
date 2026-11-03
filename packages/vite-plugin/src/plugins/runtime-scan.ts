import type { Rolldown } from 'vite';
import { scanning } from './scan.ts';

export type RuntimeResolver = (
	source: string,
	importer: string | undefined
) => Promise<string | undefined>;

const runtimeId = '\0vite-plugin-svelte:runtime-scan';

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withEntry(input: Rolldown.InputOption | undefined): Rolldown.InputOption {
	if (input === undefined) return [runtimeId];
	if (typeof input === 'string') return [input, runtimeId];
	if (Array.isArray(input)) return [...input, runtimeId];
	return { ...input, [runtimeId]: runtimeId };
}

function crawler(
	name: string,
	entries: readonly string[],
	owned: RegExp,
	resolve: RuntimeResolver
): Rolldown.Plugin {
	return {
		name,
		resolveId: {
			order: 'pre',
			async handler(source, importer) {
				if (source === runtimeId) return { id: source };
				if (importer === undefined || !owned.test(source)) return null;
				const file = await resolve(source, importer === runtimeId ? undefined : importer);
				return file === undefined || /[\\/]node_modules[\\/]/.test(file) ? null : { id: file };
			}
		},
		load: {
			filter: { id: new RegExp(`^${escape(runtimeId)}$`) },
			handler: () => ({
				code: entries.map((entry) => `import ${JSON.stringify(entry)};\n`).join(''),
				moduleType: 'js'
			})
		}
	};
}

export function runtimeScanPlugin(
	entries: readonly string[],
	packages: readonly string[],
	resolve: RuntimeResolver
): Rolldown.Plugin {
	const owned = new RegExp(`^(?:${packages.map(escape).join('|')})(?:/[^?#]+)?$`);
	const plugin: Rolldown.Plugin = {
		name: 'vite-plugin-svelte:runtime-scan',
		options(input) {
			if (entries.length === 0 || !scanning(input)) return;
			const plugins = (input.plugins ?? []) as Rolldown.Plugin[];
			return {
				...input,
				input: withEntry(input.input),
				plugins: plugins.map((entry) =>
					entry === plugin ? crawler(plugin.name, entries, owned, resolve) : entry
				)
			};
		}
	};
	return plugin;
}
