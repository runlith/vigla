import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { treeNamed, type Tree } from '../trees.ts';

export interface Unit {
	tree: Tree;
	app: string;
	dir: string;
	scripts: readonly string[];
}

const appScripts = [
	'test:dev',
	'test:build',
	'test:server-side-route-resolution:dev',
	'test:server-side-route-resolution:build',
	'test:cross-platform:dev',
	'test:cross-platform:build'
];

function tree(name: string, project = 'kit'): Tree {
	const found = treeNamed(project, name);
	if (found === undefined) throw new Error(`no Kit tree ${project}/${name}`);
	return found;
}

function each(root: string, tree: Tree, scripts: readonly string[]): Unit[] {
	return readdirSync(join(root, tree.source))
		.filter((app) => existsSync(join(root, tree.source, app, 'package.json')))
		.sort()
		.map((app) => ({ tree, app, dir: `${tree.source}/${app}`, scripts }));
}

export function units(root: string, project: 'kit' | 'own' = 'kit'): Unit[] {
	if (project === 'own') return each(root, tree('kit', project), appScripts);
	return [
		{ tree: tree('units'), app: 'kit', dir: 'packages/kit', scripts: ['test:unit'] },
		{
			tree: tree('adapter-node-units'),
			app: 'adapter-node',
			dir: 'packages/adapter-node',
			scripts: ['test:unit']
		},
		{ tree: tree('types'), app: 'types', dir: 'packages/kit/test/types', scripts: [] },
		...each(root, tree('apps'), appScripts),
		...each(root, tree('prerendering'), ['test:build']),
		{
			tree: tree('build-errors'),
			app: 'build-errors',
			dir: 'packages/kit/test/build-errors',
			scripts: ['test:build']
		},
		...each(root, tree('adapter-static'), ['test']),
		...each(root, tree('adapter-node'), ['test:build', 'test:platform']),
		{
			tree: tree('adapter-bun-units'),
			app: 'adapter-bun',
			dir: 'packages/adapter-bun',
			scripts: ['test:unit']
		},
		...each(root, tree('adapter-bun'), ['test:platform', 'COMPILE=true test:platform'])
	];
}

export function reportName(unit: Unit, label: string): string {
	const prefix = unit.tree.project === 'kit' ? '' : `${unit.tree.project}.`;
	return `${prefix}${unit.tree.name}.${unit.app}.${label}.json`;
}

export function selected(all: readonly Unit[], names: readonly string[]): Unit[] {
	if (names.length === 0) return [...all];
	return all.filter((unit) => {
		const id = `${unit.tree.project}/${unit.tree.name}`;
		return (
			names.includes(id) ||
			names.includes(`${id}/${unit.app}`) ||
			(unit.tree.project === 'kit' &&
				(names.includes(unit.tree.name) || names.includes(`${unit.tree.name}/${unit.app}`)))
		);
	});
}
