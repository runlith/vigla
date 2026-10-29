import { mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Target {
	readonly name: string;
	readonly root: string;
}

export interface Prepared extends Target {
	readonly index: string;
}

interface Compiler {
	readonly VERSION: string;
	compileModule(
		source: string,
		options: { filename: string; generate: 'client'; dev: boolean }
	): { js: { code: string } };
}

function sources(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...sources(path));
		else if (entry.name.endsWith('.svelte.js')) found.push(path);
	}
	return found.sort();
}

function asyncFlag(root: string): boolean {
	const manifest = JSON.parse(
		readFileSync(join(realpathSync(join(root, 'node_modules', 'svelte')), 'package.json'), 'utf8')
	) as { exports?: Record<string, unknown> };
	return manifest.exports?.['./internal/flags/async'] !== undefined;
}

export async function prepare(
	target: Target,
	base: string,
	suites: readonly string[]
): Promise<Prepared> {
	const work = join(target.root, '.work', 'bench');
	rmSync(work, { recursive: true, force: true });
	mkdirSync(work, { recursive: true });
	const entry = join(work, 'compiler.js');
	writeFileSync(entry, "export * from 'svelte/compiler';\n");
	const compiler = (await import(pathToFileURL(entry).href)) as Compiler;
	const lines = asyncFlag(target.root) ? ["import 'svelte/internal/flags/async';"] : [];
	const lists: string[] = [];
	for (const suite of suites) {
		for (const file of sources(join(base, suite))) {
			const name = relative(base, file);
			const out = join(work, name);
			mkdirSync(dirname(out), { recursive: true });
			const compiled = compiler.compileModule(readFileSync(file, 'utf8'), {
				filename: name,
				generate: 'client',
				dev: false
			});
			writeFileSync(out, compiled.js.code);
			if (!name.endsWith('.bench.svelte.js')) continue;
			const id = `m${lists.length}`;
			lines.push(`import ${id} from './${name}';`);
			lists.push(`...${id}.map((entry) => ({ suite: '${suite}', ...entry }))`);
		}
	}
	lines.push(`export default [${lists.join(', ')}];`);
	const index = join(work, 'index.js');
	writeFileSync(index, `${lines.join('\n')}\n`);
	return { ...target, index };
}
