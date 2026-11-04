import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Alias, ResolvedConfig } from 'vite';
import type { ValidatedConfig } from '../types/builder.ts';
import type { Identity } from '../types/identity.ts';
import { diagnostics } from '../shared/diagnostics.ts';
import { resolveConfig, validateConfig } from './index.ts';

export interface FileConfig {
	config: ValidatedConfig;
	identity: Identity;
	vite: ResolvedConfig;
	api: typeof import('vite');
}

export async function importVite(root: string): Promise<typeof import('vite')> {
	const require = createRequire(path.join(root, 'package.json'));
	return import(pathToFileURL(require.resolve('vite')).href);
}

export async function loadConfig(
	root: string,
	fallback: Identity,
	file?: string,
	mode = process.env.MODE ?? 'production'
): Promise<FileConfig> {
	const api = await importVite(root);
	const vite = await api.resolveConfig({ root, configFile: file }, 'build', mode);
	const setup = vite.plugins.find((plugin) => plugin.name === 'kit:setup')?.api;
	if (setup) return { api, vite, config: setup.options, identity: setup.identity };
	const d = diagnostics(fallback);
	return {
		api,
		vite,
		config: resolveConfig(validateConfig({}, d), vite.root, d),
		identity: fallback
	};
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
