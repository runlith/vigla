import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../manifest.ts';
import { resultsDir, writeRuns, type Run } from '../reports.ts';
import { covers } from '../scope.ts';
import { install, read, store } from '../store.ts';
import { samplesOf, treeNamed, type Tree } from '../trees.ts';

const target = process.cwd();
const work = join(target, '.work', `vite-plugin-${process.pid}`);
const results = resultsDir(target);
const force = join(root, 'src', 'force.ts');

function tree(name: string): Tree {
	const found = treeNamed('vite-plugin', name);
	if (found === undefined) throw new Error(`no vite-plugin tree ${name}`);
	return found;
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

function prepare(): void {
	rmSync(work, { recursive: true, force: true });
	cpSync(samplesOf(tree('units')), join(work, 'packages', 'vite-plugin-svelte', '__tests__'), {
		recursive: true
	});
	const e2e = join(work, 'packages', 'e2e-tests');
	cpSync(samplesOf(tree('e2e')), e2e, { recursive: true });
	const into = store(join(work, 'node_modules', '.local'), locals(e2e));
	for (const name of readdirSync(e2e)) {
		const dir = join(e2e, name);
		if (name === '_test_dependencies' || !existsSync(join(dir, 'package.json'))) continue;
		install(dir, into);
	}
}

const planned: Run[] = [
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
const runs = planned.filter((run) => covers(`vite-plugin/${run.tree.name}`));

prepare();
rmSync(results, { recursive: true, force: true });
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
				VIGLA_WORK: work,
				VIGLA_TREE: `${run.tree.project}/${run.tree.name}`,
				VIGLA_MODE: run.mode ?? '',
				NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${force}`].filter(Boolean).join(' ')
			}
		}
	);
}
writeRuns(results, runs);
rmSync(work, { recursive: true, force: true });
