import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const manifest = require.resolve('@sveltejs/kit/package.json');
const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
const cli = resolve(dirname(manifest), bin['svelte-kit']);

function sync() {
	const result = spawnSync(process.execPath, [cli, 'sync'], { encoding: 'utf8' });
	expect(result.status, result.stdout + result.stderr).toBe(0);
}

test('unchanged sync preserves root and nested route declarations', () => {
	sync();
	const routes = ['src/routes', 'src/routes/dashboard'];
	const times = () => routes.map((route) => statSync(`.svelte-kit/types/${route}/$types.d.ts`).mtimeMs);
	const initial = times();
	sync();
	expect(times()).toEqual(initial);
}, 120_000);
