import fs from 'node:fs/promises';
import path from 'node:path';
import type { Environment, Plugin, ResolvedConfig, Rolldown, UserConfig } from 'vite';
import { isDepExcluded } from 'vitefu';
import type { PluginAPI } from '../api.ts';
import type { CompileError, CompileOptions } from '../compiler.ts';
import { dynamicOptions } from '../compile.ts';
import { toRollupError } from '../error.ts';
import type { FrontEnd } from '../front-end.ts';
import { arraify, type ResolvedOptions } from '../options.ts';
import { preprocessWith } from './preprocess.ts';

const sensitive = [
	'compilerOptions',
	'configFile',
	'experimental',
	'extensions',
	'preprocess'
] as const;

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bare(extension: string): string {
	return escape(extension.startsWith('.') ? extension.slice(1) : extension);
}

function componentFilter(frontEnds: readonly FrontEnd[]): RegExp {
	const extensions = frontEnds.flatMap((frontEnd) => frontEnd.components).map(bare);
	return new RegExp(`^[^?#]+\\.(?:${extensions.join('|')})(?:[?#]|$)`);
}

function moduleFilter(frontEnds: readonly FrontEnd[]): RegExp {
	const alternatives = frontEnds.map(
		(frontEnd) =>
			`(?:${frontEnd.modules.infixes.map(escape).join('|')})(?:${frontEnd.modules.extensions.map(bare).join('|')})`
	);
	return new RegExp(`^[^?#]+(?:${alternatives.join('|')})(?:[?#]|$)`);
}

function claiming(frontEnds: readonly FrontEnd[], filename: string, modules: boolean): FrontEnd {
	const found = frontEnds.find((frontEnd) =>
		modules
			? frontEnd.modules.infixes.some((infix) => filename.includes(infix))
			: frontEnd.components.some((extension) => filename.endsWith(extension))
	);
	return found ?? (frontEnds[0] as FrontEnd);
}

async function compileComponent(
	options: ResolvedOptions,
	frontEnd: FrontEnd,
	filename: string,
	code: string,
	generate: 'client' | 'server',
	environment: Environment
) {
	const compileOptions: CompileOptions = {
		dev: true,
		...options.compilerOptions,
		css: 'injected',
		filename,
		generate
	};
	const groups = arraify(options.preprocess);
	let source = code;
	if (options.preprocess) {
		const processed = await preprocessWith({ filename, frontEnd }, code, groups);
		if (processed.map) compileOptions.sourcemap = processed.map as object;
		source = processed.code;
	}
	const dynamic = await dynamicOptions(
		options,
		filename,
		source,
		compileOptions,
		environment,
		'compile'
	);
	const compiled = frontEnd.compiler.compile(
		source,
		dynamic ? { ...compileOptions, ...dynamic } : compileOptions
	);
	return { code: compiled.js.code, map: compiled.js.map as never, moduleType: 'js' as const };
}

function compileLibraryModule(
	options: ResolvedOptions,
	frontEnd: FrontEnd,
	filename: string,
	code: string,
	generate: 'client' | 'server'
) {
	const compiled = frontEnd.compiler.compileModule(code, {
		dev: options.compilerOptions?.dev ?? true,
		filename,
		generate
	});
	return { code: compiled.js.code, map: compiled.js.map as never, moduleType: 'js' as const };
}

function optimizerPlugin(
	api: PluginAPI,
	environmentName: string,
	consumer: 'client' | 'server',
	components: boolean
): Rolldown.Plugin {
	const generate = consumer === 'server' ? 'server' : 'client';
	const plugin: Rolldown.Plugin = {
		name: components ? 'vite-plugin-svelte:optimize' : 'vite-plugin-svelte:optimize-module'
	};
	plugin.options = (input) => {
		const plugins = (input.plugins ?? []) as { name?: string }[];
		if (plugins.some((entry) => entry?.name === 'vite:dep-scan:resolve')) {
			delete plugin.transform;
			return;
		}
		plugin.transform = {
			filter: { id: components ? componentFilter(api.frontEnds) : moduleFilter(api.frontEnds) },
			async handler(code: string, filename: string) {
				const frontEnd = claiming(api.frontEnds, filename, !components);
				try {
					if (!components)
						return compileLibraryModule(api.options, frontEnd, filename, code, generate);
					const environment = api.options.server?.environments[environmentName] as Environment;
					return await compileComponent(
						api.options,
						frontEnd,
						filename,
						code,
						generate,
						environment
					);
				} catch (error) {
					throw toRollupError(error as CompileError, api.options);
				}
			}
		} as Rolldown.Plugin['transform'];
	};
	return plugin;
}

async function metadataChanged(cacheDir: string, options: ResolvedOptions): Promise<boolean> {
	const metadata: Record<string, unknown> = {};
	for (const key of sensitive) metadata[key] = options[key];
	const current = JSON.stringify(metadata, (_, value) =>
		typeof value === 'function' ? value.toString() : value
	);
	const file = path.resolve(cacheDir, '_svelte_metadata.json');
	let existing: string | undefined;
	try {
		existing = await fs.readFile(file, 'utf8');
	} catch {}
	await fs.mkdir(cacheDir, { recursive: true });
	await fs.writeFile(file, current);
	return current !== existing;
}

export function setupOptimizer(api: PluginAPI): Plugin {
	let viteConfig: ResolvedConfig;
	return {
		name: 'vite-plugin-svelte:setup-optimizer',
		apply: 'serve',
		configEnvironment(name, config) {
			const consumer = config.consumer ?? (name === 'client' ? 'client' : 'server');
			const optimizeDeps: UserConfig['optimizeDeps'] = {
				extensions: [...new Set(api.frontEnds.flatMap((frontEnd) => frontEnd.components))],
				rolldownOptions: {
					plugins: [
						optimizerPlugin(api, name, consumer, true),
						optimizerPlugin(api, name, consumer, false)
					]
				}
			};
			if (consumer === 'server') {
				const exclude = config.optimizeDeps?.exclude ?? [];
				optimizeDeps.include = api.frontEnds
					.filter((frontEnd) => !isDepExcluded(frontEnd.name, exclude))
					.flatMap((frontEnd) => frontEnd.imports);
			}
			return { optimizeDeps };
		},
		configResolved(config) {
			viteConfig = config;
		},
		async buildStart() {
			if (!api.options.prebundleSvelteLibraries) return;
			if (await metadataChanged(viteConfig.cacheDir, api.options))
				viteConfig.optimizeDeps.force = true;
		}
	};
}
