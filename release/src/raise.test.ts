import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ordered } from './order.ts';
import type { Package } from './pack.ts';
import { changed, next, plan } from './raise.ts';

const root = '/repo';

function item(
	name: string,
	version: string,
	siblings: string[] = [],
	files = ['dist', 'src']
): Package {
	return {
		directory: `${root}/packages/${name.replace(/^@[^/]+\//, '')}`,
		manifest: {
			name,
			version,
			files,
			dependencies: Object.fromEntries(siblings.map((sibling) => [sibling, 'workspace:*']))
		}
	};
}

const core = item('core', '0.1.0');
const plugin = item('@x/plugin', '0.1.1', ['core']);
const kit = item('@x/kit', '0.1.1', ['core', '@x/plugin']);
const facade: Package = {
	directory: `${root}/packages/facade`,
	manifest: {
		name: '@x/facade',
		version: '3.1.1',
		files: ['dist', 'src'],
		dependencies: { '@upstream/kit': 'workspace:@x/kit@*' }
	}
};
const lone = item('@x/lone', '7.3.2', [], ['dist', 'src', 'index.d.ts']);
const packages = [facade, kit, lone, plugin, core];

test('a package changes with its published files and manifest, never with its tests', () => {
	const names = (paths: string[]) => [...changed(packages, root, paths)];
	assert.deepEqual(names(['packages/core/src/a.ts']), ['core']);
	assert.deepEqual(names(['packages/lone/index.d.ts', 'packages/kit/package.json']), [
		'@x/kit',
		'@x/lone'
	]);
	assert.deepEqual(names(['packages/core/src/a.test.ts', 'packages/core/owners.test.ts']), []);
	assert.deepEqual(names(['packages/core/conformance/a.ts', 'harness/src/a.ts']), []);
	assert.deepEqual(names(['packages/core-extra/src/a.ts']), []);
});

test('a raise reaches every package pinning a raised one, through aliases too', () => {
	assert.deepEqual(
		[...plan(packages, new Set(['@x/plugin']), new Set())],
		[
			['@x/facade', '3.1.2'],
			['@x/kit', '0.1.2'],
			['@x/plugin', '0.1.2']
		]
	);
	assert.deepEqual([...plan(packages, new Set(['@x/lone']), new Set())], [['@x/lone', '7.3.3']]);
});

test('a named package takes the next minor and its dependents the next patch', () => {
	assert.deepEqual(
		[...plan(packages, new Set(), new Set(['core']))],
		[
			['@x/facade', '3.1.2'],
			['@x/kit', '0.1.2'],
			['@x/plugin', '0.1.2'],
			['core', '0.2.0']
		]
	);
	assert.throws(() => plan(packages, new Set(), new Set(['absent'])), /absent/);
});

test('versions step by patch or minor and refuse anything else', () => {
	assert.equal(next('5.57.9', 'patch'), '5.57.10');
	assert.equal(next('0.1.4', 'minor'), '0.2.0');
	assert.throws(() => next('1.0.0-next.1', 'patch'), /major\.minor\.patch/);
});

test('publishing order puts every package after the siblings it pins', () => {
	assert.deepEqual(
		ordered(packages).map((entry) => entry.manifest.name),
		['core', '@x/plugin', '@x/kit', '@x/facade', '@x/lone']
	);
});
