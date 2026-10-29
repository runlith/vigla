import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
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

function read(root: string): Package {
	const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
		exports?: Record<string, Exports>;
	};
	return { root, exports: manifest.exports ?? {} };
}

export function locate(target: string, name: string): Package {
	const require = createRequire(join(target, 'package.json'));
	return read(realpathSync(dirname(require.resolve(`${name}/package.json`))));
}

function packageRoot(file: string): string {
	let dir = dirname(file);
	while (!existsSync(join(dir, 'package.json')) && dirname(dir) !== dir) dir = dirname(dir);
	return dir;
}

export function directory(from: string, name: string): string {
	const queue = [from];
	const seen = new Set<string>();
	for (let root = queue.shift(); root !== undefined; root = queue.shift()) {
		if (seen.has(root)) continue;
		seen.add(root);
		const require = createRequire(join(root, 'package.json'));
		try {
			return realpathSync(dirname(require.resolve(name)));
		} catch {
			const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
				dependencies?: Record<string, string>;
			};
			for (const dependency of Object.keys(manifest.dependencies ?? {})) {
				try {
					queue.push(packageRoot(realpathSync(require.resolve(dependency))));
				} catch {}
			}
		}
	}
	throw new Error(`${from} loads no ${name}`);
}

export function production(from: string, name: string): Plugin {
	const found = read(directory(from, name));
	const conditions = new Set(['production', ...server]);
	return {
		name: `harness:production:${name}`,
		enforce: 'pre',
		resolveId(source) {
			if (source !== name && !source.startsWith(`${name}/`)) return null;
			const key = source === name ? '.' : `./${source.slice(name.length + 1)}`;
			const file = pick(found.exports[key], conditions);
			return file === null ? null : join(found.root, file);
		}
	};
}

export function served(importer: string | undefined): boolean {
	return importer !== undefined && importer.replaceAll('\\', '/').includes('/_output/server/');
}

export function svelteFile(
	svelte: Package,
	source: string,
	side: 'client' | 'server'
): string | null {
	if (source !== 'svelte' && !source.startsWith('svelte/')) return null;
	const key = source === 'svelte' ? '.' : `./${source.slice('svelte/'.length)}`;
	const file = pick(svelte.exports[key], side === 'server' ? server : client);
	return file === null ? null : join(svelte.root, file);
}

export function borrowed(work: string, anchor: string): Plugin {
	const prefix = `${work.replaceAll('\\', '/')}/`;
	return {
		name: 'harness:borrowed',
		enforce: 'pre',
		async resolveId(source, importer) {
			if (importer === undefined || !importer.replaceAll('\\', '/').startsWith(prefix)) return null;
			if (/^[./]/.test(source) || isBuiltin(source)) return null;
			if (source === 'svelte' || source.startsWith('svelte/')) return null;
			const own = await this.resolve(source, importer, { skipSelf: true });
			return own ?? this.resolve(source, anchor, { skipSelf: true });
		}
	};
}

export function resolver(
	target: string,
	aliases: Readonly<Record<string, string>>,
	scoped: (source: string, importer: string | undefined) => string | null
): Plugin {
	const svelte = locate(target, 'svelte');
	return {
		name: 'harness:target',
		enforce: 'pre',
		resolveId(source, importer) {
			const alias = aliases[source] ?? scoped(source, importer);
			if (alias !== null && alias !== undefined) return alias;
			return svelteFile(svelte, source, served(importer) ? 'server' : 'client');
		}
	};
}
