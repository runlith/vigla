import type { Names } from '@vigla/vite-plugin';

const docs = 'https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs';

export const names: Partial<Names> = {
	prebundle: 'prebundleSvelteLibraries',
	resolveWarnings: 'disableSvelteResolveWarnings',
	warningsEvent: 'svelte:warnings',
	styleFlag: 'svelte',
	metaKey: 'svelte',
	metadataFile: '_svelte_metadata.json',
	withoutSources: [
		'@sveltejs/kit',
		'@sveltejs/package',
		'@sveltejs/vite-plugin-svelte',
		'svelte2tsx',
		'svelte-check',
		'svelte-preprocess'
	],
	withoutSourcesPrefixes: ['@sveltejs/adapter-'],
	links: {
		cssHash: `${docs}/faq.md#why-should-csshash-be-calculated-from-filename-during-dev`,
		preprocess: `${docs}/preprocess.md`,
		missingCondition: `${docs}/faq.md#missing-exports-condition`
	}
};
