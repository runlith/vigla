import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const target = resolve(process.argv[2] ?? '.');
const parts = [target, join(target, 'vite-plugin'), join(target, 'kit')].filter((dir) =>
	existsSync(join(dir, 'package.json'))
);

const failed: string[] = [];
for (const dir of parts) {
	const result = spawnSync('bun', ['run', 'test'], { cwd: dir, stdio: 'inherit' });
	if (result.status !== 0) failed.push(dir);
}
for (const dir of failed) console.error(`failed: ${dir}`);
process.exit(failed.length > 0 ? 1 : 0);
