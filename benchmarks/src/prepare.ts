import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Target {
	readonly name: string;
	readonly root: string;
}

export interface Prepared extends Target {
	readonly work: string;
	readonly indexes: Readonly<Record<string, string>>;
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
		else found.push(path);
	}
	return found.sort();
}

const benchmark = /\.bench(\.svelte)?\.js$/;

function asyncFlag(root: string): boolean {
	const manifest = JSON.parse(
		readFileSync(join(realpathSync(join(root, 'node_modules', 'svelte')), 'package.json'), 'utf8')
	) as { exports?: Record<string, unknown> };
	return manifest.exports?.['./internal/flags/async'] !== undefined;
}

export async function prepare(
	target: Target,
	base: string,
	suites: readonly string[],
	shared: readonly string[]
): Promise<Prepared> {
	const work = join(target.root, '.work', `bench-${process.pid}`);
	rmSync(work, { recursive: true, force: true });
	mkdirSync(work, { recursive: true });
	try {
		return { ...target, work, indexes: await build(target, work, base, suites, shared) };
	} catch (error) {
		rmSync(work, { recursive: true, force: true });
		throw error;
	}
}

async function build(
	target: Target,
	work: string,
	base: string,
	suites: readonly string[],
	shared: readonly string[]
): Promise<Record<string, string>> {
	const entry = join(work, 'compiler.js');
	writeFileSync(entry, "export * from 'svelte/compiler';\n");
	const compiler = (await import(pathToFileURL(entry).href)) as Compiler;
	const flag = asyncFlag(target.root) ? ["import 'svelte/internal/flags/async';"] : [];
	const indexes: Record<string, string> = {};
	for (const dir of [...shared, ...suites]) {
		const lines = [...flag];
		const lists: string[] = [];
		for (const file of sources(join(base, dir))) {
			const name = relative(base, file);
			const out = join(work, name);
			mkdirSync(dirname(out), { recursive: true });
			if (name.endsWith('.svelte.js')) {
				const compiled = compiler.compileModule(readFileSync(file, 'utf8'), {
					filename: name,
					generate: 'client',
					dev: false
				});
				writeFileSync(out, compiled.js.code);
			} else copyFileSync(file, out);
			if (!benchmark.test(name)) continue;
			const id = `m${lists.length}`;
			lines.push(`import ${id} from './${name}';`);
			lists.push(`...${id}.map((entry) => ({ suite: '${dir}', ...entry }))`);
		}
		if (!suites.includes(dir)) continue;
		lines.push(`export default [${lists.join(', ')}];`);
		const index = join(work, `${dir}.index.js`);
		writeFileSync(index, `${lines.join('\n')}\n`);
		indexes[dir] = index;
	}
	return indexes;
}
