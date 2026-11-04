import type { Identity } from '@vigla/kit/vite';

const docs = 'https://svelte.dev/docs/kit/';

export const identity: Identity = {
	name: 'sveltekit',
	product: 'SvelteKit',
	framework: 'Svelte',
	plugin: 'sveltekit',
	command: 'svelte-kit',
	outDir: '.svelte-kit',
	assets: '/_svelte_kit_assets',
	announcer: 'svelte-announcer',
	packages: ['@sveltejs/kit', '@vigla/kit'],
	diagnostics: 'https://svelte.dev/e/kit/',
	links: {
		formFields: `${docs}remote-functions#form-Fields`,
		formValidation: `${docs}remote-functions#form-Programmatic-validation`,
		prerender: `${docs}@sveltejs-kit-vite#prerender`,
		prerenderConflicts: `${docs}page-options#prerender-Route-conflicts`,
		namedActions: `${docs}form-actions#Named-actions`,
		enhance: `${docs}form-actions#Progressive-enhancement-use:enhance`,
		transport: `${docs}hooks#transport`,
		handle: `${docs}hooks#handle`,
		observability: `${docs}observability#opentelemetry-api`,
		fetch: `${docs}web-standards#Fetch-APIs`,
		adapters: `${docs}adapters`
	},
	replacedLinkOptions: { keepfocus: 'reset="false"', noscroll: 'reset="false"' }
};
