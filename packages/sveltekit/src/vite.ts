import { createKit, type Framework } from '@vigla/kit/vite';
import { svelte, type Options } from '@vigla/vite-plugin-svelte';
import { identity } from './identity.ts';

export type * from '@vigla/kit/vite';

export const sveltekit: Framework<Options> = createKit(identity, svelte);
