import { spawnSync } from 'node:child_process';
import { cpSync, globSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { rolldown } from 'rolldown';

const tsrs = path.join(
	path.dirname(createRequire(import.meta.url).resolve('tsrs/package.json')),
	'bin/tsrs'
);

export function run(command: string, args: string[], cwd: string, output = true): void {
	const result = spawnSync(command, args, {
		cwd,
		stdio: ['inherit', output ? 'inherit' : 'ignore', 'inherit']
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(
			`${command} ${args.join(' ')} failed in ${cwd} (${result.signal ?? result.status})`
		);
}

export function emit(directory: string): void {
	const out = path.join(directory, 'dist');
	rmSync(out, { recursive: true, force: true });
	run(process.execPath, [tsrs, '-p', 'tsconfig.build.json'], directory);
	for (const file of globSync('**/*.d.ts', { cwd: path.join(directory, 'src') }))
		cpSync(path.join(directory, 'src', file), path.join(out, file));
}

export async function bundle(directory: string, input: string, output: string): Promise<void> {
	const build = await rolldown({
		cwd: directory,
		input: path.resolve(directory, input),
		platform: 'node'
	});
	try {
		await build.write({
			file: path.resolve(directory, output),
			format: 'cjs',
			exports: 'named',
			sourcemap: true
		});
	} finally {
		await build.close();
	}
}
