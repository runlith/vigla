import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);

function binary(name, command) {
	const manifest = require.resolve(`${name}/package.json`);
	const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
	return resolve(dirname(manifest), bin[command]);
}

function run(command, args) {
	const result = spawnSync(command, args, { encoding: 'utf8' });
	expect(result.status, result.stdout + result.stderr).toBe(0);
}

test('a large static RouteId union remains a valid resolve argument', () => {
	for (let index = 0; index < 31; index++) {
		const directory = `src/routes/blog/entry-${index}`;
		mkdirSync(directory, { recursive: true });
		writeFileSync(`${directory}/+page.svelte`, '<h1>entry</h1>\n');
	}
	run(process.execPath, [binary('@sveltejs/kit', 'svelte-kit'), 'sync']);
	run(binary('tsrs', 'tsrs'), ['-p', 'tsconfig.json', '--pretty', 'false']);
}, 120_000);
