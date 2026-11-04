import process from 'node:process';
import type { Plugin, UserConfig } from 'vite';
import type { PluginAPI } from './api.ts';
import { loadConfig, type LoadedConfig } from './config-file.ts';
import { createIdentity, type Naming } from './identity.ts';
import { compile } from './plugins/compile.ts';
import { compileModule } from './plugins/compile-module.ts';
import { configure } from './plugins/configure.ts';
import { hotUpdate } from './plugins/hot-update.ts';
import { loadCompiledCss, loadCustom } from './plugins/load.ts';
import { setupOptimizer } from './plugins/optimizer.ts';
import { preprocess } from './plugins/preprocess.ts';
import type { RawOptions } from './options.ts';
import type { Options } from './public.ts';

export { vitePreprocess } from './preprocess.ts';
export type * from './public.ts';
export type { PluginAPI } from './api.ts';
export type { Compiler } from './compiler.ts';
export type { LoadedConfig } from './config-file.ts';
export type { FrontEnd } from './front-end.ts';
export type { History, Links, Names, Naming } from './identity.ts';
export type { Log } from './log.ts';

export interface PluginFactory<O extends object = Options> {
	(inline?: Partial<O>): Plugin[];
	readonly marker: string;
	loadConfig(
		viteConfig?: UserConfig,
		inline?: Partial<O>,
		stem?: string
	): Promise<LoadedConfig | undefined>;
}

export function createPlugin<O extends object = Options>(naming: Naming): PluginFactory<O> {
	const identity = createIdentity(naming);
	const { name } = identity;
	const factory = (inline?: Partial<O>): Plugin[] => {
		if (process.env.DEBUG != null) identity.log.setLevel('debug');
		const api = {} as PluginAPI;
		return [
			{ name, api },
			configure(api, identity, inline as RawOptions | undefined),
			setupOptimizer(api, identity),
			loadCompiledCss(api, identity),
			loadCustom(api, identity),
			preprocess(api, identity),
			compile(api, identity),
			compileModule(api, identity),
			hotUpdate(api, identity)
		];
	};
	return Object.assign(factory, {
		marker: name,
		loadConfig: (viteConfig?: UserConfig, inline?: Partial<O>, stem?: string) =>
			loadConfig(identity.log, viteConfig, inline as RawOptions | undefined, stem)
	});
}

export const vigla: PluginFactory<Options> = createPlugin<Options>({ name: 'vigla' });
