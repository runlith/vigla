import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Unit {
	tree: string;
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

function each(root: string, tree: string, base: string, scripts: readonly string[]): Unit[] {
	return readdirSync(join(root, base))
		.filter((app) => existsSync(join(root, base, app, 'package.json')))
		.sort()
		.map((app) => ({ tree, app, dir: `${base}/${app}`, scripts }));
}

export function units(root: string): Unit[] {
	return [
		{ tree: 'units', app: 'kit', dir: 'packages/kit', scripts: ['test:unit'] },
		{
			tree: 'adapter-node-units',
			app: 'adapter-node',
			dir: 'packages/adapter-node',
			scripts: ['test:unit']
		},
		{ tree: 'types', app: 'types', dir: 'packages/kit/test/types', scripts: [] },
		...each(root, 'apps', 'packages/kit/test/apps', appScripts),
		...each(root, 'prerendering', 'packages/kit/test/prerendering', ['test:build']),
		{
			tree: 'build-errors',
			app: 'build-errors',
			dir: 'packages/kit/test/build-errors',
			scripts: ['test:build']
		},
		...each(root, 'adapter-static', 'packages/adapter-static/test/apps', ['test']),
		...each(root, 'adapter-node', 'packages/adapter-node/test/apps', [
			'test:build',
			'test:platform'
		])
	];
}

export function reportName(unit: Unit, label: string): string {
	return `${unit.tree}.${unit.app}.${label}.json`;
}

export function selected(all: readonly Unit[], names: readonly string[]): Unit[] {
	if (names.length === 0) return [...all];
	return all.filter(
		(unit) => names.includes(unit.tree) || names.includes(`${unit.tree}/${unit.app}`)
	);
}
