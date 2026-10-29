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
import { log } from './log.ts';
import type { Options, SvelteConfig } from './public.ts';

export interface PreResolvedOptions extends Options {
	root: string;
	isBuild: boolean;
	isServe: boolean;
	isDebug: boolean;
	extensions: string[];
	emitCss: boolean;
	prebundleSvelteLibraries: boolean;
}

export interface ResolvedOptions extends PreResolvedOptions {
	compilerOptions: CompileOptions;
	isProduction: boolean;
	server?: ViteDevServer;
}

const FAQ = 'https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/faq.md';
const cssHashLink = `${FAQ}#why-should-csshash-be-calculated-from-filename-during-dev`;
const transformLink =
	'https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/advanced-usage.md#transform-svelte-files-with-vite-plugins';

const pluginOptions = new Set([
	'include',
	'exclude',
	'emitCss',
	'disableDependencyReinclusion',
	'prebundleSvelteLibraries',
	'inspector',
	'dynamicCompileOptions',
	'experimental'
]);
const rootOptions = new Set(['extensions', 'compilerOptions', 'preprocess', 'onwarn']);
const inlineOptions = new Set(['configFile', ...pluginOptions, ...rootOptions]);

export function arraify<T>(value: T | T[] | null | undefined): T[] {
	return value == null ? [] : Array.isArray(value) ? value : [value];
}

export function validateInlineOptions(options: Partial<Options> | undefined): void {
	const invalid = Object.keys(options ?? {}).filter((key) => !inlineOptions.has(key));
	if (invalid.length > 0) {
		log.warn(
			`invalid plugin ${invalid.length === 1 ? 'option' : 'options'} ${invalid.map((key) => `\`${key}\``).join(', ')} in inline config`
		);
	}
}

function convertPluginOptions(
	config: (Partial<SvelteConfig> & { configFile?: string }) | undefined
): Partial<Options> | undefined {
	if (!config) return undefined;
	const misplaced = Object.keys(config).filter((key) => pluginOptions.has(key));
	if (misplaced.length > 0) {
		throw new Error(
			`Invalid options in svelte config. Move the following options into 'vitePlugin:{...}': ${misplaced.join(', ')}`
		);
	}
	if (!config.vitePlugin) return config as Partial<Options>;
	const plugin = config.vitePlugin as Record<string, unknown>;
	const keys = Object.keys(plugin);
	const atRoot = keys.filter((key) => rootOptions.has(key));
	if (atRoot.length > 0) {
		throw new Error(
			`Invalid options in svelte config under vitePlugin:{...}', move them to the config root : ${atRoot.join(', ')}`
		);
	}
	const duplicate = keys.filter((key) => Object.prototype.hasOwnProperty.call(config, key));
	if (duplicate.length > 0) {
		throw new Error(
			`Invalid duplicate options in svelte config under vitePlugin:{...}', they are defined in root too and must only exist once: ${duplicate.join(', ')}`
		);
	}
	const unknown = keys.filter((key) => !pluginOptions.has(key));
	if (unknown.length > 0) {
		log.warn(
			`ignoring unknown plugin options in svelte config under vitePlugin:{...}: ${unknown.join(', ')}`
		);
		for (const key of unknown) delete plugin[key];
	}
	const result: Record<string, unknown> = { ...config, ...plugin };
	delete result.vitePlugin;
	return result as Partial<Options>;
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
	inline: Partial<Options> | undefined,
	viteUserConfig: UserConfig,
	viteEnv: ConfigEnv,
	frontEnds: readonly FrontEnd[]
): Promise<PreResolvedOptions> {
	const root = viteRoot(viteUserConfig);
	const isBuild = viteEnv.command === 'build';
	const defaults = {
		extensions: [...new Set(frontEnds.flatMap((frontEnd) => frontEnd.components))],
		emitCss: true,
		prebundleSvelteLibraries: !isBuild
	};
	const loaded = convertPluginOptions(
		await loadConfigFile({ ...viteUserConfig, root }, inline, frontEnds)
	);
	const extra = {
		root,
		isBuild,
		isServe: viteEnv.command === 'serve',
		isDebug: process.env.DEBUG != null
	};
	const merged = mergeConfigs<PreResolvedOptions>(defaults, loaded, inline ?? {}, extra);
	if (loaded?.configFile) merged.configFile = loaded.configFile;
	return merged;
}

function enforceOptionsForHmr(options: ResolvedOptions, viteConfig: ResolvedConfig): void {
	const compilerOptions = options.compilerOptions;
	if (compilerOptions.hmr && viteConfig.server?.hmr === false) {
		log.warn(
			'vite config server.hmr is false but compilerOptions.hmr is true. Forcing compilerOptions.hmr to false as it would not work.'
		);
		compilerOptions.hmr = false;
	}
	if (options.isServe && compilerOptions.hmr && options.emitCss && compilerOptions.cssHash) {
		let usesFilename = false;
		let usesCss = false;
		compilerOptions.cssHash({
			get filename() {
				usesFilename = true;
				return 'Foo.svelte';
			},
			get css() {
				usesCss = true;
				return '.foo{}';
			},
			name: 'Foo',
			hash: (input) => input
		});
		if (!usesFilename || usesCss) {
			log.warn(
				`The custom compilerOptions.cssHash in your svelte config can degrade your DX. See ${cssHashLink} for more information.`
			);
		}
	}
}

function enforceOptionsForProduction(options: ResolvedOptions): void {
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

function removeIgnoredOptions(options: ResolvedOptions): void {
	const ignored = ['generate', 'format', 'filename'];
	const passed = Object.keys(options.compilerOptions ?? {}).filter((key) => ignored.includes(key));
	if (passed.length === 0) return;
	log.warn(
		`The following Svelte compilerOptions are controlled by vite-plugin-svelte and essential to its functionality. User-specified values are ignored. Please remove them from your configuration: ${passed.join(', ')}`
	);
	for (const key of passed) delete options.compilerOptions[key];
}

function handleDeprecatedOptions(options: ResolvedOptions): void {
	const experimental = options.experimental as Record<string, unknown> | undefined;
	if (!experimental) return;
	const own = options as unknown as Record<string, unknown>;
	for (const promoted of ['prebundleSvelteLibraries', 'inspector', 'dynamicCompileOptions']) {
		if (!experimental[promoted]) continue;
		own[promoted] = experimental[promoted];
		delete experimental[promoted];
		log.warn(
			`Option "experimental.${promoted}" is no longer experimental and has moved to "${promoted}". Please update your Svelte or Vite config.`
		);
	}
}

function logRemovedPluginApi(config: ResolvedConfig): void {
	const using = config.plugins.filter(
		(plugin) => (plugin?.api as { sveltePreprocess?: unknown } | undefined)?.sveltePreprocess
	);
	if (using.length === 0) return;
	log.error.once(
		`The following vite plugins use the removed 'plugin.api.sveltePreprocess' api: ${using.map((plugin) => plugin.name).join(', ')}
				These preprocessors are no longer added to your svelte config and if your application depends on them it breaks.
				Update the plugins or contact their maintainers. See ${transformLink} for more information.
				`.replace(/\t+/g, '\t')
	);
}

export function resolveOptions(
	preResolved: PreResolvedOptions,
	viteConfig: ResolvedConfig
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
	removeIgnoredOptions(merged);
	handleDeprecatedOptions(merged);
	logRemovedPluginApi(viteConfig);
	enforceOptionsForHmr(merged, viteConfig);
	enforceOptionsForProduction(merged);
	return merged;
}
