import { expect, test } from 'vitest';
import { svelte } from './index.ts';

test('svelte() names its marker and plugins as vite-plugin-svelte', () => {
	expect(svelte.marker).toBe('vite-plugin-svelte');
	expect(svelte({ configFile: false }).map((plugin) => plugin.name)).toEqual([
		'vite-plugin-svelte',
		'vite-plugin-svelte:config',
		'vite-plugin-svelte:setup-optimizer',
		'vite-plugin-svelte:load-compiled-css',
		'vite-plugin-svelte:load-custom',
		'vite-plugin-svelte:preprocess',
		'vite-plugin-svelte:compile',
		'vite-plugin-svelte:compile-module',
		'vite-plugin-svelte:hot-update'
	]);
});
