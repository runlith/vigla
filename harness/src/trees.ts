import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { root } from './manifest.ts';

export type Repository = 'kit' | 'vite-plugin';

export interface Tree {
	project: Repository;
	name: string;
	source: string;
	exclude: readonly string[];
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
		exclude: []
	},
	{
		project: 'vite-plugin',
		name: 'e2e',
		source: 'packages/e2e-tests',
		exclude: ['inspector-kit', 'inspector-vite']
	}
];

export function treeFiles(dir: string, exclude: readonly string[] = []): string[] {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() || entry.isSymbolicLink())
		.map((entry) => relative(dir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
		.filter(
			(file) =>
				!file.split('/').includes('node_modules') &&
				!exclude.some((path) => file === path || file.startsWith(`${path}/`))
		)
		.sort();
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
	if (tree.name === 'units') return `${base} > ${titles}`;
	const at = segments.lastIndexOf(tree.source.split('/').at(-1) ?? '');
	if (at < 0 || at + 1 >= segments.length) return null;
	return `${segments[at + 1]}/${base} > ${titles}`;
}

export function treeNamed(project: string, name: string): Tree | undefined {
	return trees.find((tree) => tree.project === project && tree.name === name);
}

export function samplesOf(tree: Tree): string {
	return join(root, 'samples', tree.project, tree.name);
}
