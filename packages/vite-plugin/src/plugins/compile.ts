import type { Plugin } from 'vite';
import type { PluginAPI } from '../api.ts';
import { compileComponent, type Compiled } from '../compile.ts';
import type { CompileError } from '../compiler.ts';
import { toRollupError } from '../error.ts';
import type { Identity } from '../identity.ts';
import { logCompilerWarnings } from '../warnings.ts';

export function compile(api: PluginAPI, identity: Identity): Plugin {
	const { name, log, names } = identity;
	const plugin: Plugin = {
		name: `${name}:compile`,
		configResolved() {
			Object.assign(plugin.transform as object, { filter: api.filter });
		},
		transform: {
			async handler(code, id) {
				const ssr = this.environment.config.consumer === 'server';
				const request = api.idParser(id, ssr);
				if (!request || request.raw) return undefined;
				let compiled: Compiled;
				try {
					compiled = await compileComponent(
						request,
						code,
						api.options,
						this.environment,
						identity,
						this.getCombinedSourcemap() as unknown as object
					);
				} catch (error) {
					throw toRollupError(error as CompileError, api.options);
				}
				if (compiled.compiled.warnings) {
					logCompilerWarnings(request, compiled.compiled.warnings, api.options, identity);
				}
				return {
					code: compiled.compiled.js.code,
					map: compiled.compiled.js.map as never,
					moduleType: 'js',
					meta: {
						[names.metaKey]: { css: compiled.compiled.css }
					}
				};
			}
		}
	};
	return plugin;
}
