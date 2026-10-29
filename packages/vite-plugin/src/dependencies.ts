const withoutSources = [
	'@lukeed/uuid',
	'@playwright/test',
	'@sveltejs/kit',
	'@sveltejs/package',
	'@sveltejs/vite-plugin-svelte',
	'autoprefixer',
	'cookie',
	'dotenv',
	'esbuild',
	'eslint',
	'jest',
	'mdsvex',
	'playwright',
	'postcss',
	'prettier',
	'svelte2tsx',
	'svelte-check',
	'svelte-preprocess',
	'tslib',
	'typescript',
	'vite',
	'vitest',
	'__vite-browser-external'
];

const prefixesWithoutSources = [
	'@fontsource/',
	'@postcss-plugins/',
	'@rollup/',
	'@sveltejs/adapter-',
	'@types/',
	'@typescript-eslint/',
	'eslint-',
	'jest-',
	'postcss-plugin-',
	'prettier-plugin-',
	'rollup-plugin-',
	'vite-plugin-'
];

export function shipsNoSources(dependency: string): boolean {
	return (
		withoutSources.includes(dependency) ||
		prefixesWithoutSources.some((prefix) =>
			prefix.startsWith('@')
				? dependency.startsWith(prefix)
				: dependency.substring(dependency.lastIndexOf('/') + 1).startsWith(prefix)
		)
	);
}
