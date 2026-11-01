import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Alias, ResolvedConfig } from 'vite';
import type { ValidatedConfig } from '../types/builder.ts';
import { resolveConfig, validateConfig } from './index.ts';

export interface FileConfig {
	config: ValidatedConfig;
	vite: ResolvedConfig;
	api: typeof import('vite');
}

export async function importVite(root: string): Promise<typeof import('vite')> {
	const require = createRequire(path.join(root, 'package.json'));
	return import(pathToFileURL(require.resolve('vite')).href);
}

export async function loadConfig(
	root: string,
	file?: string,
	mode = process.env.MODE ?? 'production'
): Promise<FileConfig> {
	const api = await importVite(root);
	const vite = await api.resolveConfig({ root, configFile: file }, 'build', mode);
	const options: ValidatedConfig | undefined = vite.plugins.find(
		(plugin) => plugin.name === 'kit:setup'
	)?.api.options;
	return { api, vite, config: options ?? resolveConfig(validateConfig({}), vite.root) };
}

export function configAliases(config: ValidatedConfig, root: string): Alias[] {
	return Object.entries(config.alias).map(([key, value]) => {
		const replacement = path
			.resolve(root, value.replaceAll('\\', '/').replace(/\/\*$/, ''))
			.replaceAll('\\', '/');
		if (key.endsWith('/*')) {
			return {
				find: new RegExp(`^${escapePattern(key.slice(0, -2))}/(.+)$`),
				replacement: `${replacement}/$1`
			};
		}
		return {
			find: `${key}/*` in config.alias ? new RegExp(`^${escapePattern(key)}$`) : key,
			replacement
		};
	});
}

function escapePattern(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
