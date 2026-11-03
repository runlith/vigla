import fs from 'node:fs';
import type { Plugin } from 'vite';
import type { PluginAPI } from '../api.ts';
import type { Css } from '../compiler.ts';
import { virtualStyle } from '../id.ts';
import type { Identity } from '../identity.ts';

interface CssMeta {
	svelte?: { css?: Css | null };
}

export function loadCompiledCss(api: PluginAPI, { name, log }: Identity): Plugin {
	let cached = false;
	const kept = new Map<string, Css>();
	const filter = { id: virtualStyle };
	return {
		name: `${name}:load-compiled-css`,
		configResolved(config) {
			cached = config.command === 'serve' || !!config.build?.watch;
		},
		resolveId: {
			filter,
			handler(id) {
				log.debug(`resolveId resolved virtual css module ${id}`, undefined, 'resolve');
				return id;
			}
		},
		load: {
			filter,
			async handler(id) {
				const ssr = this.environment.config.consumer === 'server';
				const request = api.idParser(id, ssr);
				if (!request) return undefined;
				const meta = (moduleId: string) =>
					(this.getModuleInfo(moduleId)?.meta as CssMeta | undefined)?.svelte?.css ?? undefined;
				let css = meta(request.filename);
				if (!css) {
					const resolved = await this.resolve(request.filename);
					if (resolved?.id) css = meta(resolved.id);
				}
				if (cached) {
					if (css) kept.set(request.filename, css);
					else css = kept.get(request.filename);
				}
				if (!css) {
					log.warn(`failed to load virtual css module ${id}`, undefined, 'load');
					return undefined;
				}
				const { hasGlobal, code, map } = css;
				return {
					code,
					map: map as never,
					moduleType: 'css',
					meta:
						hasGlobal === false
							? { vite: { cssScopeTo: [request.filename, 'default'] as const } }
							: undefined
				};
			}
		}
	};
}

export function loadCustom(api: PluginAPI, { name, log }: Identity): Plugin {
	const plugin: Plugin = {
		name: `${name}:load-custom`,
		enforce: 'pre',
		configResolved() {
			Object.assign(plugin.load as object, { filter: api.filter });
		},
		load: {
			async handler(id) {
				const config = this.environment.config;
				const request = api.idParser(id, config.consumer === 'server');
				if (!request || request.query.url || !config.assetsInclude(request.filename)) {
					return undefined;
				}
				log.debug(
					`loading ${request.filename} to prevent vite asset handling to turn it into a url by default`,
					undefined,
					'load'
				);
				return fs.readFileSync(request.filename, 'utf-8');
			}
		}
	};
	return plugin;
}
