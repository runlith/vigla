import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig, Rollup, ViteDevServer } from 'vite';
import type { PluginAPI } from '../api.ts';
import type { CompileError, PreprocessorGroup, Processed } from '../compiler.ts';
import { toRollupError } from '../error.ts';
import type { ComponentRequest } from '../id.ts';
import { log } from '../log.ts';
import { mapToRelative } from '../maps.ts';
import { arraify } from '../options.ts';

type Preprocess = (request: ComponentRequest, code: string) => Promise<Processed | undefined>;

interface Tagged {
	__resolvedConfig?: ResolvedConfig | null;
}

export async function preprocessWith(
	request: { filename: string; frontEnd: ComponentRequest['frontEnd'] },
	code: string,
	groups: PreprocessorGroup[]
): Promise<Processed> {
	const { filename } = request;
	try {
		return await request.frontEnd.compiler.preprocess(code, groups, { filename });
	} catch (error) {
		const failure = error as Error;
		failure.message = `Error while preprocessing ${filename}${failure.message ? ` - ${failure.message}` : ''}`;
		throw failure;
	}
}

function createPreprocess(groups: PreprocessorGroup[], config: ResolvedConfig): Preprocess {
	for (const group of groups) {
		const style = group.style as (PreprocessorGroup['style'] & Tagged) | undefined;
		if (style && '__resolvedConfig' in style) style.__resolvedConfig = config;
	}
	return async (request, code) => {
		const processed = await preprocessWith(request, code, groups);
		if (typeof processed?.map === 'object') mapToRelative(processed.map, request.filename);
		return processed;
	};
}

class Dependencies {
	readonly #dependencies = new Map<string, string[]>();
	readonly #dependants = new Map<string, Set<string>>();
	readonly #server: ViteDevServer;

	constructor(server: ViteDevServer) {
		this.#server = server;
		const changed = (filename: string) => {
			for (const dependant of this.#dependants.get(filename) ?? []) {
				if (!fs.existsSync(dependant)) continue;
				log.debug(
					`emitting virtual change event for "${dependant}" because dependency "${filename}" changed`,
					undefined,
					'hmr'
				);
				server.watcher.emit('change', dependant);
			}
		};
		server.watcher.on('change', changed);
		server.watcher.on('unlink', changed);
	}

	#watch(file: string): void {
		const root = this.#server.config.root;
		if (file && !file.startsWith(`${root}/`) && !file.includes('\0') && fs.existsSync(file)) {
			this.#server.watcher.add(path.resolve(file));
		}
	}

	clear(): void {
		this.#dependencies.clear();
		this.#dependants.clear();
	}

	update(request: ComponentRequest, dependencies: string[]): void {
		const id = request.normalizedFilename;
		const previous = this.#dependencies.get(id) ?? [];
		this.#dependencies.set(id, dependencies);
		for (const dependency of dependencies) {
			if (previous.includes(dependency)) continue;
			this.#watch(dependency);
			let dependants = this.#dependants.get(dependency);
			if (dependants === undefined) {
				dependants = new Set();
				this.#dependants.set(dependency, dependants);
			}
			dependants.add(request.filename);
		}
		for (const dependency of previous) {
			if (!dependencies.includes(dependency)) {
				this.#dependants.get(dependency)?.delete(request.filename);
			}
		}
	}
}

export function preprocess(api: PluginAPI): Plugin {
	let run: Preprocess | undefined;
	let dependencies: Dependencies | undefined;
	const plugin: Plugin = {
		name: 'vite-plugin-svelte:preprocess',
		enforce: 'pre',
		configResolved(config) {
			const groups = arraify(api.options.preprocess);
			if (groups.length > 0) {
				run = createPreprocess(groups, config);
				Object.assign(plugin.transform as object, { filter: api.filter });
			} else {
				log.debug(
					`disabling ${plugin.name} because no preprocessor is configured`,
					undefined,
					'preprocess'
				);
				run = undefined;
				Object.assign(plugin.transform as object, { filter: { id: /$./ } });
			}
		},
		configureServer(server) {
			dependencies = new Dependencies(server);
		},
		buildStart() {
			dependencies?.clear();
		},
		transform: {
			async handler(code, id) {
				const request = api.idParser(id, this.environment.config.consumer === 'server');
				if (!request || run === undefined) return undefined;
				try {
					const processed = await run(request, code);
					dependencies?.update(request, processed?.dependencies ?? []);
					if (!processed) return undefined;
					if (
						api.options.isBuild &&
						this.environment.config.build.watch &&
						processed.dependencies
					) {
						for (const dependency of processed.dependencies) this.addWatchFile(dependency);
					}
					const result: Rollup.SourceDescription = { code: processed.code };
					if (processed.map) result.map = processed.map as never;
					return result;
				} catch (error) {
					throw toRollupError(error as CompileError, api.options);
				}
			}
		}
	};
	return plugin;
}
