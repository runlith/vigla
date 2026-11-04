import path from 'node:path';
import process from 'node:process';
import deepmerge from 'deepmerge';
import {
	normalizePath,
	type ConfigEnv,
	type ResolvedConfig,
	type UserConfig,
	type ViteDevServer
} from 'vite';
import type { CompileOptions } from './compiler.ts';
import { loadConfigFile } from './config-file.ts';
import type { FrontEnd } from './front-end.ts';
import { ownNames, type Identity, type Names } from './identity.ts';
import type { Log } from './log.ts';
import type { Config, Options } from './public.ts';

export type RawOptions = Partial<Options>;

export interface PreResolvedOptions extends Options {
	root: string;
	isBuild: boolean;
	isServe: boolean;
	isDebug: boolean;
	extensions: string[];
	emitCss: boolean;
	prebundleLibraries: boolean;
}

export interface ResolvedOptions extends PreResolvedOptions {
	compilerOptions: CompileOptions;
	isProduction: boolean;
	server?: ViteDevServer;
}

const rootOptions = new Set(['extensions', 'compilerOptions', 'preprocess', 'onwarn']);

function pluginOptions(names: Names): Set<string> {
	return new Set([
		'include',
		'exclude',
		'emitCss',
		'disableDependencyReinclusion',
		names.prebundle,
		'inspector',
		'dynamicCompileOptions',
		'experimental'
	]);
}

function toOwnNames(source: Record<string, unknown>, names: Names): Record<string, unknown> {
	const result = { ...source };
	if (names.prebundle !== ownNames.prebundle && names.prebundle in result) {
		result[ownNames.prebundle] = result[names.prebundle];
		delete result[names.prebundle];
	}
	const experimental = result.experimental as Record<string, unknown> | undefined;
	if (
		names.resolveWarnings !== ownNames.resolveWarnings &&
		experimental != null &&
		names.resolveWarnings in experimental
	) {
		const renamed = {
			...experimental,
			[ownNames.resolveWarnings]: experimental[names.resolveWarnings]
		};
		delete renamed[names.resolveWarnings];
		result.experimental = renamed;
	}
	return result;
}

export function arraify<T>(value: T | T[] | null | undefined): T[] {
	return value == null ? [] : Array.isArray(value) ? value : [value];
}

export function validateInlineOptions(
	options: RawOptions | undefined,
	{ names, log }: Identity
): void {
	const accepted = new Set(['configFile', ...pluginOptions(names), ...rootOptions]);
	const invalid = Object.keys(options ?? {}).filter((key) => !accepted.has(key));
	if (invalid.length > 0) {
		log.warn(
			`invalid plugin ${invalid.length === 1 ? 'option' : 'options'} ${invalid.map((key) => `\`${key}\``).join(', ')} in inline config`
		);
	}
}

function convertPluginOptions(
	config: (Partial<Config> & { configFile?: string }) | undefined,
	{ names, messages, log }: Identity
): RawOptions | undefined {
	if (!config) return undefined;
	const pluginKeys = pluginOptions(names);
	const misplaced = Object.keys(config).filter((key) => pluginKeys.has(key));
	if (misplaced.length > 0) {
		throw new Error(messages.optionsMisplaced(misplaced.join(', ')));
	}
	if (!config.vitePlugin) return config as RawOptions;
	const plugin = config.vitePlugin as Record<string, unknown>;
	const keys = Object.keys(plugin);
	const atRoot = keys.filter((key) => rootOptions.has(key));
	if (atRoot.length > 0) {
		throw new Error(messages.optionsAtRoot(atRoot.join(', ')));
	}
	const duplicate = keys.filter((key) => Object.prototype.hasOwnProperty.call(config, key));
	if (duplicate.length > 0) {
		throw new Error(messages.optionsDuplicate(duplicate.join(', ')));
	}
	const unknown = keys.filter((key) => !pluginKeys.has(key));
	if (unknown.length > 0) {
		log.warn(messages.optionsUnknown(unknown.join(', ')));
		for (const key of unknown) delete plugin[key];
	}
	const result: Record<string, unknown> = { ...config, ...plugin };
	delete result.vitePlugin;
	return result as RawOptions;
}

function mergeConfigs<T>(...configs: (object | undefined)[]): T {
	let result: object = {};
	for (const config of configs) {
		if (config == null) continue;
		result = deepmerge(result, config, { arrayMerge: (target, source) => source ?? target });
	}
	return result as T;
}

export function viteRoot(config: UserConfig): string {
	return normalizePath(config.root ? path.resolve(config.root) : process.cwd());
}

export async function preResolveOptions(
	inline: RawOptions | undefined,
	viteUserConfig: UserConfig,
	viteEnv: ConfigEnv,
	frontEnds: readonly FrontEnd[],
	identity: Identity
): Promise<PreResolvedOptions> {
	const { names, history, log } = identity;
	const root = viteRoot(viteUserConfig);
	const isBuild = viteEnv.command === 'build';
	const defaults = {
		extensions: [...new Set(frontEnds.flatMap((frontEnd) => frontEnd.components))],
		emitCss: true,
		[names.prebundle]: !isBuild
	};
	const stems = frontEnds.map((frontEnd) => frontEnd.config);
	const loaded = convertPluginOptions(
		await loadConfigFile({ ...viteUserConfig, root }, inline, stems, identity),
		identity
	);
	const extra = {
		root,
		isBuild,
		isServe: viteEnv.command === 'serve',
		isDebug: process.env.DEBUG != null
	};
	const merged = mergeConfigs<Record<string, unknown>>(defaults, loaded, inline ?? {}, extra);
	if (loaded?.configFile) merged.configFile = loaded.configFile;
	history.options?.(merged, log);
	return toOwnNames(merged, names) as unknown as PreResolvedOptions;
}

function enforceOptionsForHmr(
	options: ResolvedOptions,
	viteConfig: ResolvedConfig,
	frontEnds: readonly FrontEnd[],
	{ names, messages, log }: Identity
): void {
	const compilerOptions = options.compilerOptions;
	if (compilerOptions.hmr && viteConfig.server?.hmr === false) {
		log.warn(
			'vite config server.hmr is false but compilerOptions.hmr is true. Forcing compilerOptions.hmr to false as it would not work.'
		);
		compilerOptions.hmr = false;
	}
	const extension = frontEnds[0]?.components[0];
	if (
		extension &&
		options.isServe &&
		compilerOptions.hmr &&
		options.emitCss &&
		compilerOptions.cssHash
	) {
		let usesFilename = false;
		let usesCss = false;
		compilerOptions.cssHash({
			get filename() {
				usesFilename = true;
				return `Foo${extension}`;
			},
			get css() {
				usesCss = true;
				return '.foo{}';
			},
			name: 'Foo',
			hash: (input) => input
		});
		if (!usesFilename || usesCss) {
			const link = names.links.cssHash;
			log.warn(`${messages.cssHash}${link ? ` See ${link} for more information.` : ''}`);
		}
	}
}

function enforceOptionsForProduction(options: ResolvedOptions, log: Log): void {
	if (!options.isProduction) return;
	if (options.compilerOptions.hmr) {
		log.warn(
			'you are building for production but compilerOptions.hmr is true, forcing it to false'
		);
		options.compilerOptions.hmr = false;
	}
	if (options.compilerOptions.dev) {
		log.warn(
			'you are building for production but compilerOptions.dev is true, forcing it to false'
		);
		options.compilerOptions.dev = false;
	}
}

function removeIgnoredOptions(options: ResolvedOptions, { name, messages, log }: Identity): void {
	const ignored = ['generate', 'format', 'filename'];
	const passed = Object.keys(options.compilerOptions ?? {}).filter((key) => ignored.includes(key));
	if (passed.length === 0) return;
	log.warn(messages.controlledOptions(name, passed.join(', ')));
	for (const key of passed) delete options.compilerOptions[key];
}

export function resolveOptions(
	preResolved: PreResolvedOptions,
	viteConfig: ResolvedConfig,
	frontEnds: readonly FrontEnd[],
	identity: Identity
): ResolvedOptions {
	const defaults = {
		compilerOptions: {
			css: preResolved.emitCss ? 'external' : 'injected',
			dev: !viteConfig.isProduction,
			hmr:
				!viteConfig.isProduction &&
				!preResolved.isBuild &&
				viteConfig.server &&
				viteConfig.server.hmr !== false
		}
	};
	const extra = { root: viteConfig.root, isProduction: viteConfig.isProduction };
	const merged = mergeConfigs<ResolvedOptions>(defaults, preResolved, extra);
	const { log } = identity;
	removeIgnoredOptions(merged, identity);
	identity.history.config?.(viteConfig, log);
	enforceOptionsForHmr(merged, viteConfig, frontEnds, identity);
	enforceOptionsForProduction(merged, log);
	return merged;
}
