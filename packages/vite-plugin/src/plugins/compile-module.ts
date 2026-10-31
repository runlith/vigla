import type { Plugin } from 'vite';
import type { PluginAPI } from '../api.ts';
import { dynamicOptions } from '../compile.ts';
import type { CompileError, CompileOptions } from '../compiler.ts';
import { toRollupError } from '../error.ts';
import { buildModuleIdFilter, buildModuleIdParser, type ModuleIdParser } from '../id.ts';
import { log } from '../log.ts';
import { logCompilerWarnings } from '../warnings.ts';

export function compileModule(api: PluginAPI): Plugin {
	let idParser: ModuleIdParser;
	const plugin: Plugin = {
		name: 'vite-plugin-svelte:compile-module',
		enforce: 'post',
		configResolved() {
			Object.assign(plugin.transform as object, {
				filter: buildModuleIdFilter(api.options, api.frontEnds)
			});
			idParser = buildModuleIdParser(api.options, api.frontEnds);
		},
		transform: {
			async handler(code, id) {
				const ssr = this.environment.config.consumer === 'server';
				const request = idParser(id, ssr);
				if (!request) return undefined;
				const filename = request.filename;
				const compileOptions: CompileOptions = {
					...api.moduleOptions,
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

				if (log.debug.enabled) {
					log.debug(
						`final module options for ${filename}: ${JSON.stringify(final)}`,
						undefined,
						'compileModule'
					);
				}
				try {
					const result = request.frontEnd.compiler.compileModule(code, final);
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
