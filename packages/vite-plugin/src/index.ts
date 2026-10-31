import process from 'node:process';
import type { Plugin } from 'vite';
import type { PluginAPI } from './api.ts';
import { log } from './log.ts';
import { compile } from './plugins/compile.ts';
import { compileModule } from './plugins/compile-module.ts';
import { configure } from './plugins/configure.ts';
import { hotUpdate } from './plugins/hot-update.ts';
import { loadCompiledCss, loadCustom } from './plugins/load.ts';
import { setupOptimizer } from './plugins/optimizer.ts';
import { preprocess } from './plugins/preprocess.ts';
import type { Options } from './public.ts';

export { loadSvelteConfig } from './config-file.ts';
export { vitePreprocess } from './preprocess.ts';
export type * from './public.ts';
export type { PluginAPI } from './api.ts';
export type { Compiler } from './compiler.ts';
export type { FrontEnd } from './front-end.ts';

export function svelte(inline?: Partial<Options>): Plugin[] {
	if (process.env.DEBUG != null) log.setLevel('debug');
	const api = {} as PluginAPI;
	return [
		{ name: 'vite-plugin-svelte', api },
		configure(api, inline),
		setupOptimizer(api),
		loadCompiledCss(api),
		loadCustom(api),
		preprocess(api),
		compile(api),
		compileModule(api),
		hotUpdate(api)
	];
}
