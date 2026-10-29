import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './manifest.ts';

export type Repository = 'kit' | 'vite-plugin';

export interface Tree {
	project: Repository;
	name: string;
	source: string;
	exclude: readonly string[];
	key: 'file' | 'path' | 'none';
	rewrites?: Readonly<Record<string, string>>;
	include?: RegExp;
}

const kitRewrites: Readonly<Record<string, string>> = {
	'../../../../adapter-static/index.js': '@sveltejs/adapter-static',
	'../../../../../adapter-auto/index.js': '@sveltejs/adapter-auto',
	'../../src/utils/format.js': '@dromon/harness/kit/format',
	'../../../../src/utils/format.js': '@dromon/harness/kit/format'
};

function kit(
	name: string,
	source: string,
	key: Tree['key'],
	exclude: readonly string[] = []
): Tree {
	return { project: 'kit', name, source, exclude, key, rewrites: kitRewrites };
}

export const repositories: Readonly<Record<Repository, string>> = {
	kit: join(root, '..', '.external', 'kit'),
	'vite-plugin': join(root, '..', '.external', 'vite-plugin-svelte')
};

export const trees: readonly Tree[] = [
	{
		project: 'vite-plugin',
		name: 'units',
		source: 'packages/vite-plugin-svelte/__tests__',
		exclude: [],
		key: 'file'
	},
	{
		project: 'vite-plugin',
		name: 'e2e',
		source: 'packages/e2e-tests',
		exclude: ['inspector-kit', 'inspector-vite'],
		key: 'file'
	},
	kit('apps', 'packages/kit/test/apps', 'path'),
	kit('build-errors', 'packages/kit/test/build-errors', 'path'),
	kit('prerendering', 'packages/kit/test/prerendering', 'path'),
	kit('types', 'packages/kit/test/types', 'path'),
	kit('support', 'packages/kit/test', 'none', ['apps', 'build-errors', 'prerendering', 'types']),
	kit('test-utils', 'test-utils', 'none'),
	kit('test-redirect-importer', 'packages/test-redirect-importer', 'none'),
	{
		...kit('adapter-static', 'packages/adapter-static/test/apps', 'path'),
		rewrites: { ...kitRewrites, '../../../index.js': '@sveltejs/adapter-static' }
	},
	kit('adapter-static-support', 'packages/adapter-static/test', 'none', ['apps']),
	{
		...kit('adapter-node', 'packages/adapter-node/test/apps', 'path'),
		rewrites: { ...kitRewrites, '../../../index.js': '@sveltejs/adapter-node' }
	},
	kit('adapter-node-support', 'packages/adapter-node/test', 'none', ['apps']),
	{ ...kit('units', 'packages/kit/src', 'path'), include: /\.spec\.js$/ },
	{ ...kit('adapter-node-units', 'packages/adapter-node/src', 'path'), include: /\.spec\.ts$/ }
];

export function treeFiles(
	dir: string,
	exclude: readonly string[] = [],
	include?: RegExp
): string[] {
	const found: string[] = [];
	const walk = (at: string): void => {
		for (const entry of readdirSync(join(dir, at), { withFileTypes: true })) {
			const file = at === '' ? entry.name : `${at}/${entry.name}`;
			if (entry.name === 'node_modules') continue;
			if (exclude.some((path) => file === path || file.startsWith(`${path}/`))) continue;
			if (entry.isDirectory()) walk(file);
			else if (
				(entry.isFile() || entry.isSymbolicLink()) &&
				(include === undefined || include.test(file))
			)
				found.push(file);
		}
	};
	walk('');
	return found.sort();
}

export function entryOfTree(
	tree: Tree,
	file: string,
	ancestors: readonly string[],
	title: string
): string | null {
	const segments = file.replaceAll('\\', '/').split('/');
	const titles = [...ancestors, title].join(' > ');
	const base = segments.at(-1) ?? '';
	if (tree.key === 'none') return null;
	if (tree.name === 'units' && tree.key === 'file') return `${base} > ${titles}`;
	const source = tree.source.split('/');
	let at = -1;
	for (let index = segments.length - source.length; index >= 0 && at < 0; index--) {
		if (source.every((segment, offset) => segments[index + offset] === segment))
			at = index + source.length - 1;
	}
	if (at < 0 || at + 1 >= segments.length) return null;
	if (at + 2 === segments.length || tree.name.endsWith('units'))
		return `${segments.slice(at + 1).join('/')} > ${titles}`;
	const rest = tree.key === 'path' ? segments.slice(at + 2).join('/') : base;
	return `${segments[at + 1]}/${rest} > ${titles}`;
}

export function treeNamed(project: string, name: string): Tree | undefined {
	return trees.find((tree) => tree.project === project && tree.name === name);
}

export function samplesOf(tree: Tree): string {
	return join(root, 'samples', tree.project, tree.name);
}
