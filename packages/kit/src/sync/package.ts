import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const kit = '@vigla/kit';

export interface Installation {
	readonly name: string;
	readonly path: string;
}

interface Manifest {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	vigla?: { facade?: string };
}

function read(file: string): Manifest | undefined {
	if (!existsSync(file)) return undefined;
	return JSON.parse(readFileSync(file, 'utf8')) as Manifest;
}

function installed(name: string, from: string): Manifest | undefined {
	for (let dir = from; ; dir = dirname(dir)) {
		const manifest = read(join(dir, 'node_modules', name, 'package.json'));
		if (manifest !== undefined || dirname(dir) === dir) return manifest;
	}
}

export function installation(root: string): Installation {
	for (let dir = root; ; dir = dirname(dir)) {
		const manifest = read(join(dir, 'package.json'));
		const names = Object.keys({ ...manifest?.dependencies, ...manifest?.devDependencies });
		for (const name of names) {
			const found = installed(name, dir);
			if (found?.name === kit) return { name, path: name };
			if (found?.vigla?.facade === kit) return { name, path: `${name} > ${kit}` };
		}
		if (dirname(dir) === dir) return { name: kit, path: kit };
	}
}
