import process from 'node:process';
import type { Plugin } from 'vite';
import type { PluginAPI } from '../api.ts';
import { frontEnds } from '../front-end.ts';
import { buildIdFilter, buildIdParser } from '../id.ts';
import type { Identity } from '../identity.ts';
import {
	arraify,
	preResolveOptions,
	resolveOptions,
	validateInlineOptions,
	viteRoot,
	type PreResolvedOptions,
	type RawOptions
} from '../options.ts';
import { configureStyles } from '../preprocess.ts';
import { buildExtraViteConfig, ensureEnvironmentResolve } from '../vite-config.ts';

export function configure(api: PluginAPI, identity: Identity, inline?: RawOptions): Plugin {
	const { log } = identity;
	validateInlineOptions(inline, identity);
	let preResolved: PreResolvedOptions;
	return {
		name: `${identity.name}:config`,
		api,
		enforce: 'pre',
		config: {
			order: 'pre',
			async handler(config, env) {
				if (process.env.DEBUG) log.setLevel('debug');
				else if (config.logLevel) log.setLevel(config.logLevel);
				api.frontEnds = await frontEnds(viteRoot(config));
				preResolved = await preResolveOptions(inline, config, env, api.frontEnds, identity);
				await configureStyles(arraify(preResolved.preprocess), config);
				const extra = await buildExtraViteConfig(preResolved, config, api.frontEnds, identity);
				log.debug('additional vite config', extra, 'config');
				return extra;
			}
		},
		configResolved: {
			order: 'pre',
			handler(config) {
				api.options = resolveOptions(preResolved, config, api.frontEnds, identity);
				api.moduleOptions = {
					...preResolved.compilerOptions,
					dev: api.options.compilerOptions.dev
				};
				api.filter = buildIdFilter(api.options, api.frontEnds, identity);
				api.idParser = buildIdParser(api.options, api.frontEnds, identity);
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
