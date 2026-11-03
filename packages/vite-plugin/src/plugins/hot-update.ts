import path from 'node:path';
import type { EnvironmentModuleNode, Plugin, ViteDevServer } from 'vite';
import type { PluginAPI } from '../api.ts';
import { configNames } from '../config-file.ts';
import { virtualStyle } from '../id.ts';
import type { Identity } from '../identity.ts';
import type { Log } from '../log.ts';

function normalize(code: string | null | undefined): string | null | undefined {
	if (code == null) return code;
	return code
		.replace(/(\$\.add_locations\(.*), (\[\[[\d, [\]]+]])\)/g, '$1, []')
		.replace(/[?&]t=\d{13}\b/g, '');
}

function same(previous: string | null | undefined, next: string | null | undefined): boolean {
	return (
		(previous == null && next == null) || (previous != null && next != null && previous === next)
	);
}

function changed(
	previous: string | null | undefined,
	next: string | null | undefined,
	id: string | null,
	log: Log
): boolean {
	if (same(previous, next)) return false;
	const loose = same(normalize(previous), normalize(next));
	if (loose) {
		log.debug(
			`ignoring compiler output change for ${id} as it is equal to previous output after normalization`,
			undefined,
			'hmr'
		);
	}
	return !loose;
}

function watchConfig(api: PluginAPI, { name, log }: Identity, server: ViteDevServer): void {
	const configFile = api.options.configFile;
	if (configFile === false) return;
	const { watcher, ws } = server;
	const { root, server: serverConfig } = server.config;
	const restart = (filename: string) => {
		if (serverConfig.middlewareMode) {
			const message = 'Config file change detected, restart your dev process to apply the changes.';
			log.info(message, filename);
			ws.send({
				type: 'error',
				err: { message, stack: '', plugin: name, id: filename }
			});
		} else {
			log.info(`config file changed: restarting vite server. - file: ${filename}`);
			void server.restart();
		}
	};
	if (configFile) {
		const onConfig = (filename: string) => {
			if (filename === configFile) restart(filename);
		};
		watcher.on('change', onConfig);
		watcher.on('unlink', onConfig);
	} else {
		const stems = api.frontEnds.map((frontEnd) => frontEnd.config);
		const candidates = configNames(stems).map((file) => path.join(root, file));
		watcher.on('add', (filename: string) => {
			if (candidates.includes(filename)) restart(filename);
		});
	}
}

export function hotUpdate(api: PluginAPI, identity: Identity): Plugin {
	const { log } = identity;
	const results = new Map<string | null, string>();
	const plugin: Plugin = {
		name: `${identity.name}:hot-update`,
		enforce: 'post',
		configResolved() {
			Object.assign(plugin.transform as object, {
				filter: {
					id: {
						include: [...api.filter.id.include, virtualStyle],
						exclude: [
							/\/node_modules\//,
							...api.filter.id.exclude.filter((item) => item !== virtualStyle)
						]
					}
				}
			});
		},
		applyToEnvironment(environment) {
			const enabled = api.options.compilerOptions.hmr && api.options.emitCss;
			return !!enabled && environment.config.consumer === 'client';
		},
		configureServer(server) {
			const client = Object.values(server.environments).find(
				(environment) => environment.config.consumer === 'client'
			);
			if (client) watchConfig(api, identity, server);
			else {
				log.warn(
					'No client environment found, not adding watchers for config file and preprocessor dependencies'
				);
			}
		},
		buildStart() {
			results.clear();
		},
		transform: {
			order: 'post',
			handler(code, id) {
				results.set(id, code);
			}
		},
		hotUpdate: {
			order: 'post',
			async handler(context) {
				const request = api.idParser(context.file, false, context.timestamp);
				if (!request) return undefined;
				const own: EnvironmentModuleNode[] = [];
				const others: EnvironmentModuleNode[] = [];
				for (const module of context.modules) {
					(results.has(module.id) ? own : others).push(module);
				}
				if (own.length === 0) return undefined;
				const previous = own.map((module) => results.get(module.id));
				const seen = new Set<string>();
				const transform = async (url: string) => {
					if (seen.has(url)) return;
					seen.add(url);
					await this.environment.transformRequest(url);
				};
				await transform(request.filename);
				const affected: EnvironmentModuleNode[] = [];
				for (const [index, module] of own.entries()) {
					await transform(module.url);
					if (changed(previous[index], results.get(module.id), module.id, log))
						affected.push(module);
					else {
						log.debug(
							`skipping hot update for ${module.id} because result is unchanged`,
							undefined,
							'hmr'
						);
					}
				}
				log.debug(
					`hotUpdate for ${request.id} result: [${affected.map((module) => module.id).join(', ')}]`,
					undefined,
					'hmr'
				);
				return [...affected, ...others];
			}
		}
	};
	return plugin;
}
