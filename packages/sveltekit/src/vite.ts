import { createKit, type Config, type Framework } from '@vigla/kit/vite';
import { svelte, type Options } from '@vigla/vite-plugin-svelte';
import { checkConfig } from './history/config.ts';
import { appModules, history, type HookEntries } from './history/plugin.ts';
import { identity } from './identity.ts';

export type * from '@vigla/kit/vite';

const kit = createKit(identity, svelte);

export const sveltekit: Framework<Options> = async (config: Config<Options> = {}) => {
	checkConfig(config);
	const plugins = await kit(config);
	const setup = plugins.find((plugin) => plugin.name === 'kit:setup')!;
	return [appModules((): HookEntries => setup.api.hooks()), history(config), ...plugins];
};
