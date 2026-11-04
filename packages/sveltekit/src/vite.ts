import {
	createKit,
	type Config as KitConfig,
	type ExperimentalConfig as KitExperimentalConfig,
	type Framework as KitFramework
} from '@vigla/kit/vite';
import { svelte, type Options } from '@vigla/vite-plugin-svelte';
import { retiredBuilder } from './history/adapter.ts';
import { componentWarnings } from './history/components.ts';
import { checkConfig } from './history/config.ts';
import { appModules, history, type HookEntries } from './history/plugin.ts';
import { identity } from './identity.ts';

export type * from '@vigla/kit/vite';
export type Config = KitConfig<Options>;
export type ExperimentalConfig = KitExperimentalConfig<Options>;
export type Framework = KitFramework<Options>;

const kit = createKit(identity, svelte);

export const sveltekit: Framework = async (config: Config = {}) => {
	checkConfig(config);
	const plugins = await kit({ ...config, adapter: retiredBuilder(config.adapter) });
	const setup = plugins.find((plugin) => plugin.name === 'kit:setup')!;
	return [
		appModules((): HookEntries => setup.api.hooks()),
		history(config),
		componentWarnings(),
		...plugins
	];
};
