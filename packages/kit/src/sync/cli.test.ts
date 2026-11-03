import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const roots: string[] = [];
const packageRoot = resolve(import.meta.dirname, '../..');
const cli = join(packageRoot, 'src/sync/bin.ts');
const require = createRequire(join(packageRoot, 'package.json'));

function project(files: Record<string, string>) {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'kit-cli-')));
	roots.push(root);
	const put = (file: string, source: string) => {
		const target = join(root, file);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, source);
	};
	put(
		'package.json',
		JSON.stringify({ type: 'module', dependencies: { '@sveltejs/kit': 'workspace:*' } })
	);
	mkdirSync(join(root, 'node_modules/@sveltejs'), { recursive: true });
	symlinkSync(packageRoot, join(root, 'node_modules/@sveltejs/kit'), 'dir');
	symlinkSync(
		dirname(require.resolve('vite/package.json')),
		join(root, 'node_modules/vite'),
		'dir'
	);
	for (const [file, source] of Object.entries(files)) put(file, source);
	return {
		root,
		run: (...args: string[]) =>
			spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 30_000 }),
		read: (file: string) => readFileSync(join(root, file), 'utf8')
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('sync loads the selected Vite config and mode and writes route and environment declarations', () => {
	const app = project({
		'custom.config.js': `import { kit } from '@sveltejs/kit/vite'; export default { plugins: [kit({ extensions: ['.view'], outDir: 'generated' })] };`,
		'src/routes/[slug]/+page.view': '',
		'src/env.ts': `import { dev } from '$app/env'; import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ [import.meta.env.MODE === 'cli-test' && !dev ? 'PUBLIC_MODE' : 'WRONG_MODE']: { public: true }, SECRET: {} });`,
		'tsconfig.json': '{ "extends": "$app/tsconfig" }'
	});
	const result = app.run('sync', '-c', 'custom.config.js', '--mode', 'cli-test');
	expect(result.status, result.stdout + result.stderr).toBe(0);
	expect(JSON.parse(app.read('node_modules/$app/tsconfig.json')).compilerOptions.types).toEqual([
		'$app/types'
	]);
	expect(app.read('generated/types/src/routes/[slug]/$types.d.ts')).toContain(
		'from "@sveltejs/kit"'
	);
	const env = app.read('node_modules/$app/types/env.d.ts');
	expect(env).toContain('export const PUBLIC_MODE: string');
	expect(env).toContain('export const SECRET: string');
	expect(env).not.toContain('WRONG_MODE');
});

test('unknown commands exit with status one without writing generated files', () => {
	const app = project({});
	const result = app.run('unknown');
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('Unknown command: unknown');
	expect(existsSync(join(app.root, 'node_modules/$app'))).toBe(false);
});

test('a failed config load removes the placeholder compiler configuration', () => {
	const app = project({ 'vite.config.js': 'throw new Error("invalid app config");' });
	const result = app.run('sync');
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('invalid app config');
	expect(existsSync(join(app.root, 'node_modules/$app'))).toBe(false);
});
