import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { UserConfig } from 'vite';
import { frontEnds, type FrontEnd } from './front-end.ts';
import { log } from './log.ts';
import type { Options, SvelteConfig } from './public.ts';

export type LoadedConfig = Partial<SvelteConfig> & { configFile?: string };

export function configNames(list: readonly FrontEnd[]): string[] {
	return list.flatMap((frontEnd) =>
		['js', 'ts', 'mjs', 'mts'].map((extension) => `${frontEnd.config}.${extension}`)
	);
}

function find(
	root: string,
	inline: Partial<Options> | undefined,
	list: readonly FrontEnd[]
): string | undefined {
	if (inline?.configFile) {
		const file = path.isAbsolute(inline.configFile)
			? inline.configFile
			: path.resolve(root, inline.configFile);
		if (!fs.existsSync(file)) throw new Error(`failed to find svelte config file ${file}.`);
		return file;
	}
	const existing = configNames(list)
		.map((name) => path.resolve(root, name))
		.filter((file) => fs.existsSync(file));
	if (existing.length === 0) {
		log.info(`no Svelte config found at ${root} - using default configuration.`);
		return undefined;
	}
	if (existing.length > 1) {
		log.warn(
			`found more than one svelte config file, using ${existing[0]}. you should only have one!`,
			existing
		);
	}
	return existing[0];
}

export async function loadConfigFile(
	viteConfig: UserConfig | undefined,
	inline: Partial<Options> | undefined,
	list: readonly FrontEnd[]
): Promise<LoadedConfig | undefined> {
	if (inline?.configFile === false) return undefined;
	const file = find(viteConfig?.root || process.cwd(), inline, list);
	if (file === undefined) return undefined;
	try {
		const url = `${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`;
		const loaded = ((await import(url)) as { default?: Partial<SvelteConfig> }).default;
		if (loaded == null) throw new Error(`invalid export in ${file}`);
		return { ...loaded, configFile: file };
	} catch (error) {
		log.error(`failed to import config ${file}`, error);
		throw error;
	}
}

export async function loadSvelteConfig(
	viteConfig?: UserConfig,
	inline?: Partial<Options>
): Promise<LoadedConfig | undefined> {
	if (inline?.configFile === false) return undefined;
	const root = viteConfig?.root || process.cwd();
	return loadConfigFile(viteConfig, inline, await frontEnds(root));
}
