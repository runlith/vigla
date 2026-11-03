import { kit, type Config } from '@vigla/kit/vite';
import { svelte } from '@vigla/vite-plugin-svelte';
import type { Plugin } from 'vite';

export type * from '@vigla/kit/vite';

export function sveltekit(config?: Config): Promise<Plugin[]> {
	return kit(config, svelte);
}
