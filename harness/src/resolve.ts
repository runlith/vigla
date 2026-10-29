import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

type Exports = string | null | Exports[] | { [condition: string]: Exports };

const client = new Set(['browser', 'import', 'module', 'default']);
const server = new Set(['import', 'module', 'node', 'default']);

function pick(entry: Exports | undefined, conditions: ReadonlySet<string>): string | null {
	if (entry === undefined || entry === null) return null;
	if (typeof entry === 'string') return entry;
	if (Array.isArray(entry)) {
		for (const item of entry) {
			const found = pick(item, conditions);
			if (found !== null) return found;
		}
		return null;
	}
	for (const [condition, value] of Object.entries(entry)) {
		if (!conditions.has(condition)) continue;
		const found = pick(value, conditions);
		if (found !== null) return found;
	}
	return null;
}

export interface Package {
	root: string;
	exports: Record<string, Exports>;
}

export function locate(target: string, name: string): Package {
	const require = createRequire(join(target, 'package.json'));
	const root = realpathSync(dirname(require.resolve(`${name}/package.json`)));
	const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
		exports?: Record<string, Exports>;
	};
	return { root, exports: manifest.exports ?? {} };
}

export function served(importer: string | undefined): boolean {
	return importer !== undefined && importer.replaceAll('\\', '/').includes('/_output/server/');
}

export function resolver(target: string, aliases: Readonly<Record<string, string>>): Plugin {
	const svelte = locate(target, 'svelte');
	return {
		name: 'harness:target',
		enforce: 'pre',
		resolveId(source, importer) {
			const alias = aliases[source];
			if (alias !== undefined) return alias;
			if (source !== 'svelte' && !source.startsWith('svelte/')) return null;
			const key = source === 'svelte' ? '.' : `./${source.slice('svelte/'.length)}`;
			const file = pick(svelte.exports[key], served(importer) ? server : client);
			return file === null ? null : join(svelte.root, file);
		}
	};
}
