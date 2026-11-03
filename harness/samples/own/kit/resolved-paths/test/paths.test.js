import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);

test('resolved path types admit server-relative URLs and normalize the root', async () => {
	const server = await createServer({
		server: { host: '127.0.0.1', port: 6401, strictPort: true },
		clearScreen: false
	});
	try {
		await server.listen();
		const response = await fetch('http://127.0.0.1:6401/base/value');
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('./about');
	} finally {
		await server.close();
	}
	const manifest = require.resolve('tsrs/package.json');
	const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
	const result = spawnSync(resolve(dirname(manifest), bin.tsrs), ['-p', 'tsconfig.json', '--pretty', 'false'], {
		encoding: 'utf8'
	});
	expect(result.status, result.stdout + result.stderr).toBe(0);
}, 120_000);
