import { cpus } from 'node:os';
import { join } from 'node:path';
import { load, ruling, runs } from '../manifest.ts';
import { selects } from '../scope.ts';
import { entryId } from '../suites.ts';
import { samplesOf, treeFiles, treeNamed, type Tree } from '../trees.ts';

const gate = join(import.meta.dirname, '..', 'gate.ts');

function idle(tree: Tree, mode: string | undefined): string[] {
	const manifest = load(tree.project, tree.name);
	const byFile = new Map<string, boolean>();
	for (const key of Object.keys(manifest.samples)) {
		const file = key.split(' > ')[0] ?? '';
		const rule = ruling(manifest, key, mode);
		const running =
			rule !== undefined &&
			runs(rule.status) &&
			selects(`${tree.project}/${tree.name}`, entryId(key, mode));
		byFile.set(file, (byFile.get(file) ?? false) || running);
	}
	return [...byFile].filter(([, running]) => !running).map(([file]) => file);
}

function tree(name: string): Tree {
	const found = treeNamed('vite-plugin', name);
	if (found === undefined) throw new Error(`no vite-plugin tree ${name}`);
	return found;
}

export function vitePlugin(): Record<string, unknown> {
	const work = process.env.VIGLA_WORK;
	if (work === undefined) throw new Error('VIGLA_WORK is not set');
	const run = process.env.VIGLA_TREE;
	const mode = process.env.VIGLA_MODE || undefined;
	if (run === 'vite-plugin/units') {
		const units = tree('units');
		const skipped = idle(units, mode).map(
			(file) => `./packages/vite-plugin-svelte/__tests__/${file}`
		);
		return {
			root: work,
			test: {
				include: ['./packages/**/__tests__/**/*.spec.[tj]s'],
				exclude: [
					'**/node_modules/**',
					'**/dist/**',
					'./packages/e2e-tests/**/*.*',
					'./temp/**/*.*',
					...skipped
				],
				globals: true,
				setupFiles: [gate],
				testTimeout: 20000,
				maxThreads: process.env.CI ? 1 : undefined,
				minThreads: process.env.CI ? 1 : undefined
			},
			esbuild: { target: 'node18' }
		};
	}
	if (run !== 'vite-plugin/e2e') throw new Error(`VIGLA_TREE names no vite-plugin run: ${run}`);
	const e2e = tree('e2e');
	const root = join(work, 'packages', 'e2e-tests');
	const timeout = process.env.CI ? 50000 : 30000;
	const threads = Math.max(1, Math.floor((cpus().length || 1) / 3));
	const exclude = [
		'**/node_modules/**',
		'**/dist/**',
		'**/cypress/**',
		'**/.{idea,git,cache,output,temp}/**'
	];
	const include = ['./packages/e2e-tests/**/*.spec.[tj]s'];
	const watched = ['./packages/e2e-tests/build-watch/**/*.spec.[tj]s'];
	if (process.env.TEST_BUILD_WATCH) include.splice(0, include.length, ...watched);
	else exclude.push(...watched);
	const present = new Set(treeFiles(samplesOf(e2e)));
	for (const key of idle(e2e, mode)) {
		const [project = '', file = ''] = key.split('/');
		const spec = `${project}/__tests__/${file}`;
		if (present.has(spec)) exclude.push(`./packages/e2e-tests/${spec}`);
	}
	return {
		root: work,
		resolve: {
			alias: {
				'~utils': join(import.meta.dirname, 'utils.ts'),
				'~upstream-utils': join(root, 'testUtils')
			}
		},
		test: {
			include,
			exclude,
			setupFiles: [gate, join(root, 'vitestSetup.ts')],
			globalSetup: [join(root, 'vitestGlobalSetup.ts')],
			testTimeout: timeout,
			hookTimeout: timeout,
			globals: true,
			onConsoleLog(log: string) {
				if (/experimental|jit engine|emitted file/i.test(log)) return false;
			},
			minThreads: threads,
			maxThreads: threads,
			retry: 0
		}
	};
}
