import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { run } from './build.ts';
import type { Manifest } from './manifest.ts';

export function held(manifest: Manifest): boolean {
	const spec = `${manifest.name}@${manifest.version}`;
	const result = spawnSync('npm', ['view', spec, 'version'], { encoding: 'utf8' });
	if (result.error) throw result.error;
	if (result.status === 0) return result.stdout.trim() !== '';
	if (result.stderr.includes('E404')) return false;
	throw new Error(`npm view ${spec} failed: ${result.stderr.trim()}`);
}

export function publish(file: string, rehearsal: boolean): void {
	run(
		'npm',
		['publish', file, '--access', 'public', ...(rehearsal ? ['--dry-run'] : [])],
		path.dirname(file)
	);
}

export async function answered(manifests: Manifest[]): Promise<void> {
	for (const manifest of manifests) while (!held(manifest)) await pause(5000);
}
