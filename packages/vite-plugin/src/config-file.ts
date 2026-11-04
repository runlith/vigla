import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { UserConfig } from 'vite';
import { frontEnds } from './front-end.ts';
import type { Identity } from './identity.ts';
import type { Config, Options } from './public.ts';

export type LoadedConfig = Partial<Config> & { configFile?: string };

export function configNames(stems: readonly string[]): string[] {
	return stems.flatMap((stem) =>
		['js', 'ts', 'mjs', 'mts'].map((extension) => `${stem}.${extension}`)
	);
}

function find(
	root: string,
	inline: Partial<Options> | undefined,
	stems: readonly string[],
	{ log, messages }: Identity
): string | undefined {
	if (inline?.configFile) {
		const file = path.isAbsolute(inline.configFile)
			? inline.configFile
			: path.resolve(root, inline.configFile);
		if (!fs.existsSync(file)) throw new Error(messages.configNotFound(file));
		return file;
	}
	const existing = configNames(stems)
		.map((name) => path.resolve(root, name))
		.filter((file) => fs.existsSync(file));
	if (existing.length === 0) {
		log.info(messages.configAbsent(root));
		return undefined;
	}
	if (existing.length > 1) {
		log.warn(messages.configsMultiple(existing[0]!), existing);
	}
	return existing[0];
}

export async function loadConfigFile(
	viteConfig: UserConfig | undefined,
	inline: Partial<Options> | undefined,
	stems: readonly string[],
	identity: Identity
): Promise<LoadedConfig | undefined> {
	if (inline?.configFile === false) return undefined;
	const file = find(viteConfig?.root || process.cwd(), inline, stems, identity);
	if (file === undefined) return undefined;
	try {
		const url = `${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`;
		const loaded = ((await import(url)) as { default?: Partial<Config> }).default;
		if (loaded == null) throw new Error(`invalid export in ${file}`);
		return { ...loaded, configFile: file };
	} catch (error) {
		identity.log.error(`failed to import config ${file}`, error);
		throw error;
	}
}

export async function loadConfig(
	identity: Identity,
	viteConfig?: UserConfig,
	inline?: Partial<Options>,
	stem?: string
): Promise<LoadedConfig | undefined> {
	if (inline?.configFile === false) return undefined;
	const root = viteConfig?.root || process.cwd();
	const stems =
		stem === undefined ? (await frontEnds(root)).map((frontEnd) => frontEnd.config) : [stem];
	return loadConfigFile(viteConfig, inline, stems, identity);
}
