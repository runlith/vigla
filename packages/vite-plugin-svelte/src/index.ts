import { createPlugin, type LoadedConfig, type Options } from '@vigla/vite-plugin';
import type { UserConfig } from 'vite';

export { vitePreprocess } from '@vigla/vite-plugin';
export type {
	Config as SvelteConfig,
	Options,
	PluginOptions,
	VitePreprocessOptions
} from '@vigla/vite-plugin';

export const svelte = createPlugin('vite-plugin-svelte');

export function loadSvelteConfig(
	viteConfig?: UserConfig,
	inline?: Partial<Options>
): Promise<LoadedConfig | undefined> {
	return svelte.loadConfig(viteConfig, inline, 'svelte.config');
}
