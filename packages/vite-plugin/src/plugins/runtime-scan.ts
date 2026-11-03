import type { Rolldown } from 'vite';
import { scanning } from './scan.ts';

export type RuntimeResolver = (
	source: string,
	importer: string | undefined
) => Promise<string | undefined>;

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withEntry(
	input: Rolldown.InputOption | undefined,
	runtimeId: string
): Rolldown.InputOption {
	if (input === undefined) return [runtimeId];
	if (typeof input === 'string') return [input, runtimeId];
	if (Array.isArray(input)) return [...input, runtimeId];
	return { ...input, [runtimeId]: runtimeId };
}

function crawler(
	name: string,
	runtimeId: string,
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
	prefix: string,
	entries: readonly string[],
	packages: readonly string[],
	resolve: RuntimeResolver
): Rolldown.Plugin {
	const owned = new RegExp(`^(?:${packages.map(escape).join('|')})(?:/[^?#]+)?$`);
	const name = `${prefix}:runtime-scan`;
	const runtimeId = `\0${name}`;
	const plugin: Rolldown.Plugin = {
		name,
		options(input) {
			if (entries.length === 0 || !scanning(input)) return;
			const plugins = (input.plugins ?? []) as Rolldown.Plugin[];
			return {
				...input,
				input: withEntry(input.input, runtimeId),
				plugins: plugins.map((entry) =>
					entry === plugin ? crawler(name, runtimeId, entries, owned, resolve) : entry
				)
			};
		}
	};
	return plugin;
}
