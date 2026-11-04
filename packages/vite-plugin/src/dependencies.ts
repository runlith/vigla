import type { Names } from './identity.ts';

const withoutSources = [
	'@lukeed/uuid',
	'@playwright/test',
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
	'@types/',
	'@typescript-eslint/',
	'eslint-',
	'jest-',
	'postcss-plugin-',
	'prettier-plugin-',
	'rollup-plugin-',
	'vite-plugin-'
];

export function shipsNoSources(names: Names, dependency: string): boolean {
	const exact = [...withoutSources, ...names.withoutSources];
	return (
		exact.includes(dependency) ||
		[...prefixesWithoutSources, ...names.withoutSourcesPrefixes].some((prefix) =>
			prefix.startsWith('@')
				? dependency.startsWith(prefix)
				: dependency.substring(dependency.lastIndexOf('/') + 1).startsWith(prefix)
		)
	);
}
