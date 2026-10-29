import process from 'node:process';
import type { Plugin } from 'vite';
import type { PluginAPI } from '../api.ts';
import { frontEnds } from '../front-end.ts';
import { buildIdFilter, buildIdParser } from '../id.ts';
import { log } from '../log.ts';
import {
	preResolveOptions,
	resolveOptions,
	validateInlineOptions,
	viteRoot,
	type PreResolvedOptions
} from '../options.ts';
import type { Options } from '../public.ts';
import { buildExtraViteConfig, ensureEnvironmentResolve } from '../vite-config.ts';

export function configure(api: PluginAPI, inline?: Partial<Options>): Plugin {
	validateInlineOptions(inline);
	let preResolved: PreResolvedOptions;
	return {
		name: 'vite-plugin-svelte:config',
		api,
		enforce: 'pre',
		config: {
			order: 'pre',
			async handler(config, env) {
				if (process.env.DEBUG) log.setLevel('debug');
				else if (config.logLevel) log.setLevel(config.logLevel);
				api.frontEnds = await frontEnds(viteRoot(config));
				preResolved = await preResolveOptions(inline, config, env, api.frontEnds);
				const extra = await buildExtraViteConfig(preResolved, config, api.frontEnds);
				log.debug('additional vite config', extra, 'config');
				return extra;
			}
		},
		configResolved: {
			order: 'pre',
			handler(config) {
				api.options = resolveOptions(preResolved, config);
				api.filter = buildIdFilter(api.options, api.frontEnds);
				api.idParser = buildIdParser(api.options, api.frontEnds);
				log.debug('resolved options', api.options, 'config');
			}
		},
		configEnvironment(name, config, opts) {
			const resolve = ensureEnvironmentResolve(name, config, opts);
			const conditions = [...new Set(api.frontEnds.map((frontEnd) => frontEnd.condition))];
			resolve.mainFields.unshift(...conditions);
			resolve.conditions.push(...conditions);
		},
		configureServer(server) {
			api.options.server = server;
		}
	};
}
