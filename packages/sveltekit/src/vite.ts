import { createKit, type Config, type Framework } from '@vigla/kit/vite';
import { svelte, type Options } from '@vigla/vite-plugin-svelte';
import { checkConfig } from './history/config.ts';
import { history } from './history/plugin.ts';
import { identity } from './identity.ts';

export type * from '@vigla/kit/vite';

const kit = createKit(identity, svelte);

export const sveltekit: Framework<Options> = async (config: Config<Options> = {}) => {
	checkConfig(config);
	return [history(config), ...(await kit(config))];
};
