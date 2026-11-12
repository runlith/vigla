import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { run } from './build.ts';
import type { Manifest } from './manifest.ts';

function view(manifest: Manifest, field: string): string | undefined {
	const spec = `${manifest.name}@${manifest.version}`;
	const result = spawnSync('npm', ['view', spec, field], { encoding: 'utf8' });
	if (result.error) throw result.error;
	if (result.status === 0) return result.stdout.trim() || undefined;
	if (result.stderr.includes('E404')) return undefined;
	throw new Error(`npm view ${spec} failed: ${result.stderr.trim()}`);
}

export function held(manifest: Manifest): boolean {
	return view(manifest, 'version') !== undefined;
}

async function served(manifest: Manifest): Promise<boolean> {
	const tarball = view(manifest, 'dist.tarball');
	if (tarball === undefined) return false;
	const response = await fetch(tarball, { method: 'HEAD' });
	if (response.ok) return true;
	if (response.status === 404) return false;
	throw new Error(`${tarball} answered ${response.status}`);
}

export function publish(file: string, rehearsal: boolean): void {
	run(
		'npm',
		['publish', file, '--access', 'public', ...(rehearsal ? ['--dry-run'] : [])],
		path.dirname(file)
	);
}

export async function answered(manifests: Manifest[]): Promise<void> {
	for (const manifest of manifests) while (!(await served(manifest))) await pause(5000);
}
