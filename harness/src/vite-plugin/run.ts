import { spawnSync } from 'node:child_process';
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { root } from '../manifest.ts';
import { summarize, type Run } from '../summary.ts';
import { samplesOf, treeNamed, type Tree } from '../trees.ts';

const target = process.cwd();
const work = join(target, '.work', `vite-plugin-${process.pid}`);
const results = join(target, '.results');
const force = join(root, 'src', 'force.ts');

function tree(name: string): Tree {
	const found = treeNamed('vite-plugin', name);
	if (found === undefined) throw new Error(`no vite-plugin tree ${name}`);
	return found;
}

interface Manifest {
	name: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function read(dir: string): Manifest {
	return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
}

function locals(e2e: string): Map<string, string> {
	const found = new Map<string, string>();
	const base = join(e2e, '_test_dependencies');
	for (const name of readdirSync(base)) {
		const dir = join(base, name);
		if (existsSync(join(dir, 'package.json'))) found.set(read(dir).name, dir);
	}
	return found;
}

interface Store {
	root: string;
	known: Map<string, string>;
	copies: Map<string, string>;
	linked: Set<string>;
}

function link(modules: string, dir: string, from: string, store: Store): void {
	const manifest = read(dir);
	for (const [name, spec] of Object.entries({
		...manifest.dependencies,
		...manifest.devDependencies
	})) {
		const local = store.known.get(name);
		if (local === undefined) continue;
		const at = join(modules, name);
		mkdirSync(join(at, '..'), { recursive: true });
		if (spec.startsWith('file:'))
			symlinkSync(copy(resolve(from, spec.slice('file:'.length)), store), at, 'dir');
		else {
			symlinkSync(local, at, 'dir');
			if (!store.linked.has(local)) {
				store.linked.add(local);
				link(join(local, 'node_modules'), local, local, store);
			}
		}
	}
}

function copy(source: string, store: Store): string {
	const done = store.copies.get(source);
	if (done !== undefined) return done;
	const name = read(source).name;
	const modules = join(store.root, String(store.copies.size), 'node_modules');
	const at = join(modules, name);
	store.copies.set(source, at);
	cpSync(source, at, {
		recursive: true,
		filter: (file) => !file.slice(source.length).split('/').includes('node_modules')
	});
	link(modules, at, source, store);
	return at;
}

function prepare(): void {
	rmSync(work, { recursive: true, force: true });
	cpSync(samplesOf(tree('units')), join(work, 'packages', 'vite-plugin-svelte', '__tests__'), {
		recursive: true
	});
	const e2e = join(work, 'packages', 'e2e-tests');
	cpSync(samplesOf(tree('e2e')), e2e, { recursive: true });
	const store: Store = {
		root: join(work, 'node_modules', '.local'),
		known: locals(e2e),
		copies: new Map(),
		linked: new Set()
	};
	for (const name of readdirSync(e2e)) {
		const dir = join(e2e, name);
		if (name === '_test_dependencies' || !existsSync(join(dir, 'package.json'))) continue;
		mkdirSync(join(dir, 'node_modules'), { recursive: true });
		link(join(dir, 'node_modules'), dir, dir, store);
	}
}

const runs: Run[] = [
	{ tree: tree('units'), file: 'units.json', env: {} },
	{ tree: tree('e2e'), mode: 'serve', file: 'e2e.serve.json', env: { CI: '1' } },
	{ tree: tree('e2e'), mode: 'build', file: 'e2e.build.json', env: { CI: '1', TEST_BUILD: '1' } },
	{
		tree: tree('e2e'),
		mode: 'build-watch',
		file: 'e2e.build-watch.json',
		env: { CI: '1', TEST_BUILD_WATCH: '1' }
	}
];

prepare();
mkdirSync(results, { recursive: true });
const vitest = join(target, 'node_modules', '.bin', 'vitest');
for (const run of runs) {
	const output = join(results, run.file);
	rmSync(output, { force: true });
	spawnSync(
		vitest,
		[
			'run',
			'-c',
			join(target, 'vitest.config.ts'),
			'--reporter=dot',
			'--reporter=json',
			`--outputFile.json=${output}`
		],
		{
			cwd: target,
			stdio: 'inherit',
			env: {
				...process.env,
				...run.env,
				DROMON_WORK: work,
				DROMON_TREE: `${run.tree.project}/${run.tree.name}`,
				DROMON_MODE: run.mode ?? '',
				NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${force}`].filter(Boolean).join(' ')
			}
		}
	);
}
rmSync(work, { recursive: true, force: true });
process.exit(summarize(runs, results));
