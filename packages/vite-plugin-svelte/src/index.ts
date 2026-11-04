import {
	createPlugin,
	type Config,
	type ExperimentalOptions,
	type PluginFactory,
	type PluginOptions as ProductPluginOptions
} from '@vigla/vite-plugin';
import type { UserConfig } from 'vite';
import { history } from './history.ts';
import { messages } from './messages.ts';
import { names } from './names.ts';

export { vitePreprocess } from '@vigla/vite-plugin';
export type { VitePreprocessOptions } from '@vigla/vite-plugin';

export interface ExperimentalPluginOptions extends Omit<
	ExperimentalOptions,
	'disableResolveWarnings'
> {
	disableSvelteResolveWarnings?: boolean;
}

export interface PluginOptions extends Omit<
	ProductPluginOptions,
	'prebundleLibraries' | 'experimental'
> {
	prebundleSvelteLibraries?: boolean;
	experimental?: ExperimentalPluginOptions;
}

export interface SvelteConfig extends Omit<Config, 'vitePlugin'> {
	vitePlugin?: PluginOptions;
}

export interface Options extends Omit<SvelteConfig, 'vitePlugin'>, PluginOptions {
	configFile?: string | false;
}

export type LoadedSvelteConfig = Partial<SvelteConfig> & { configFile?: string };

export const svelte: PluginFactory<Options> = createPlugin<Options>({
	name: 'vite-plugin-svelte',
	names,
	messages,
	history
});

export function loadSvelteConfig(
	viteConfig?: UserConfig,
	inline?: Partial<Options>
): Promise<LoadedSvelteConfig | undefined> {
	return svelte.loadConfig(viteConfig, inline, 'svelte.config') as Promise<
		LoadedSvelteConfig | undefined
	>;
}
