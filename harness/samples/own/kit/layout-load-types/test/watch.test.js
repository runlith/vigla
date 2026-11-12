import { spawnSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const manifest = require.resolve('tsrs/package.json');
const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
const checker = resolve(dirname(manifest), bin.tsrs);

function check() {
	return spawnSync(checker, ['-p', 'tsconfig.json', '--pretty', 'false'], { encoding: 'utf8' });
}

test('layout load constraints follow a child losing and regaining its load export', async () => {
	let watching;
	const server = await createServer({
		server: { host: '127.0.0.1', port: 6402, strictPort: true, hmr: false },
		clearScreen: false,
		plugins: [
			{
				name: 'watcher-ready',
				enforce: 'pre',
				configureServer(server) {
					watching = new Promise((done) => server.watcher.once('ready', done));
				}
			}
		]
	});
	try {
		await server.listen();
		await watching;
		const initial = check();
		expect(initial.status, initial.stdout + initial.stderr).toBe(0);
		const source = 'src/routes/dashboard/+page.ts';
		const original = readFileSync(source, 'utf8');
		const types = '.svelte-kit/types/src/routes/dashboard/$types.d.ts';
		const update = async (text) => {
			const time = statSync(types).mtimeMs;
			writeFileSync(source, text);
			await expect.poll(() => statSync(types).mtimeMs, { timeout: 30_000 }).not.toBe(time);
		};
		await update('export {};\n');
		const missing = check();
		expect(missing.status).toBe(2);
		expect(missing.stdout).toMatch(/src\/routes\/\+layout\.server\.ts\(\d+,\d+\): error TS2322/);
		await update(original);
		const restored = check();
		expect(restored.status, restored.stdout + restored.stderr).toBe(0);
	} finally {
		await server.close();
	}
}, 180_000);
