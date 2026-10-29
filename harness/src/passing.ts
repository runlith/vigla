import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface Declaration {
	harness?: { passing?: string };
}

export function passingDir(target: string): string | null {
	const manifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as Declaration;
	const dir = manifest.harness?.passing;
	return dir === undefined ? null : join(target, dir);
}

function file(dir: string, suite: string): string {
	return join(dir, `${suite}.txt`);
}

function parse(text: string): string[] {
	return text.split('\n').filter((line) => line !== '');
}

export function readPassing(dir: string): Map<string, Set<string>> {
	const found = new Map<string, Set<string>>();
	if (!existsSync(dir)) return found;
	for (const project of readdirSync(dir, { withFileTypes: true })) {
		if (!project.isDirectory()) continue;
		for (const entry of readdirSync(join(dir, project.name))) {
			if (!entry.endsWith('.txt')) continue;
			const suite = `${project.name}/${entry.slice(0, -'.txt'.length)}`;
			found.set(suite, new Set(parse(readFileSync(file(dir, suite), 'utf8'))));
		}
	}
	return found;
}

export function record(dir: string, suite: string, entries: Iterable<string>): void {
	const at = file(dir, suite);
	const lines = new Set(existsSync(at) ? parse(readFileSync(at, 'utf8')) : []);
	for (const entry of entries) {
		if (entry.includes('\n'))
			throw new Error(`${suite}: entry ${JSON.stringify(entry)} spans lines`);
		lines.add(entry);
	}
	mkdirSync(dirname(at), { recursive: true });
	writeFileSync(at, `${[...lines].sort().join('\n')}\n`);
}
