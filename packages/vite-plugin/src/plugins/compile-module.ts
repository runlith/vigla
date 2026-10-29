import type { Plugin } from 'vite';
import type { PluginAPI } from '../api.ts';
import { dynamicOptions } from '../compile.ts';
import type {
	CompileError,
	CompileOptions,
	Experimental,
	ModuleCompileOptions
} from '../compiler.ts';
import { toRollupError } from '../error.ts';
import { buildModuleIdFilter, buildModuleIdParser, type ModuleIdParser } from '../id.ts';
import { log } from '../log.ts';
import { logCompilerWarnings } from '../warnings.ts';

const moduleOptionNames = [
	'dev',
	'generate',
	'filename',
	'rootDir',
	'warningFilter',
	'experimental'
];
const experimentalModuleOptionNames = ['async'];

function pick<T extends object>(value: object, names: readonly string[]): T {
	return Object.fromEntries(Object.entries(value).filter(([name]) => names.includes(name))) as T;
}

function moduleOptions(options: CompileOptions): ModuleCompileOptions {
	const filtered = pick<ModuleCompileOptions>(options, moduleOptionNames);
	if (filtered.experimental) {
		filtered.experimental = pick<Experimental>(
			filtered.experimental,
			experimentalModuleOptionNames
		);
	}
	return filtered;
}

export function compileModule(api: PluginAPI): Plugin {
	let idParser: ModuleIdParser;
	let fixed: ModuleCompileOptions;
	const plugin: Plugin = {
		name: 'vite-plugin-svelte:compile-module',
		enforce: 'post',
		configResolved() {
			Object.assign(plugin.transform as object, {
				filter: buildModuleIdFilter(api.options, api.frontEnds)
			});
			idParser = buildModuleIdParser(api.options, api.frontEnds);
			fixed = moduleOptions(api.options.compilerOptions);
		},
		transform: {
			async handler(code, id) {
				const ssr = this.environment.config.consumer === 'server';
				const request = idParser(id, ssr);
				if (!request) return undefined;
				const filename = request.filename;
				const compileOptions: CompileOptions = {
					...fixed,
					dev: !this.environment.config.isProduction,
					generate: ssr ? 'server' : 'client',
					filename
				};
				const dynamic = await dynamicOptions(
					api.options,
					filename,
					code,
					compileOptions,
					this.environment,
					'compileModule'
				);
				const final: CompileOptions = dynamic ? { ...compileOptions, ...dynamic } : compileOptions;
				if (dynamic?.experimental) {
					final.experimental = { ...compileOptions.experimental, ...dynamic.experimental };
				}
				const finalModule = moduleOptions(final);
				if (log.debug.enabled) {
					log.debug(
						`final ModuleCompileOptions for  ${filename}: ${JSON.stringify(finalModule)}`,
						undefined,
						'compileModule'
					);
				}
				try {
					const result = request.frontEnd.compiler.compileModule(code, finalModule);
					logCompilerWarnings(request, result.warnings, api.options);
					return { code: result.js.code, map: result.js.map as never };
				} catch (error) {
					throw toRollupError(error as CompileError, api.options);
				}
			}
		}
	};
	return plugin;
}
