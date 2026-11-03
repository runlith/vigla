import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { installation } from './index.ts';

const roots: string[] = [];

function app(installed: Record<string, object>): string {
	const root = mkdtempSync(join(tmpdir(), 'kit-installation-'));
	roots.push(root);
	const put = (file: string, value: object) => {
		mkdirSync(dirname(join(root, file)), { recursive: true });
		writeFileSync(join(root, file), JSON.stringify(value));
	};
	put('package.json', {
		devDependencies: Object.fromEntries(Object.keys(installed).map((name) => [name, '*']))
	});
	for (const [name, manifest] of Object.entries(installed))
		put(`node_modules/${name}/package.json`, manifest);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('Kit is found under the name the app installed it or a facade of it', () => {
	const direct = app({ vite: { name: 'vite' }, '@sveltejs/kit': { name: '@vigla/kit' } });
	expect(installation(direct)).toEqual({ name: '@sveltejs/kit', path: '@sveltejs/kit' });
	const facade = app({
		'@sveltejs/kit': { name: '@vigla/sveltekit', vigla: { facade: '@vigla/kit' } }
	});
	expect(installation(facade)).toEqual({
		name: '@sveltejs/kit',
		path: '@sveltejs/kit > @vigla/kit'
	});
});
