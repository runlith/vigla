import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { load, root, ruling, runs as running } from '../manifest.ts';
import { resultsDir, writeRuns, type Run } from '../reports.ts';
import { covers, selectors, selects } from '../scope.ts';
import { install, store } from '../store.ts';
import { entryId } from '../suites.ts';
import { samplesOf, trees, type Tree } from '../trees.ts';
import { execute, labelOf, plan, type Step } from './steps.ts';
import { checkTypes } from './types.ts';
import { reportName, selected, units, type Unit } from './units.ts';

const target = process.cwd();
const work = join(target, '.work', `kit-${process.pid}`);
const results = resultsDir(target);
const bin = join(target, 'node_modules', '.bin');
const force = join(root, 'src', 'force.ts');

function packages(dir: string, into: string[]): void {
	if (existsSync(join(dir, 'package.json'))) into.push(dir);
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.'))
			continue;
		if (entry.name === 'src' || entry.name === 'static') continue;
		packages(join(dir, entry.name), into);
	}
}

function prepare(): void {
	rmSync(work, { recursive: true, force: true });
	for (const tree of trees) {
		if (tree.runner !== 'kit') continue;
		cpSync(samplesOf(tree), join(work, tree.source), { recursive: true, verbatimSymlinks: true });
	}
	const importer = join(work, 'packages', 'test-redirect-importer');
	const into = store(
		join(work, 'node_modules', '.local'),
		new Map([['test-redirect-importer', importer]]),
		join(target, 'node_modules')
	);
	const found: string[] = [];
	for (const base of [
		'packages/kit/test',
		'packages/adapter-static/test',
		'packages/adapter-node/test',
		'packages/adapter-bun/test'
	])
		packages(join(work, base), found);
	for (const dir of found) install(dir, into);
}

prepare();
rmSync(results, { recursive: true, force: true });
mkdirSync(results, { recursive: true });
const runs: Run[] = [];
function specs(tree: Tree): Step {
	const manifest = load(tree.project, tree.name);
	const files = new Set<string>();
	for (const key of Object.keys(manifest.samples)) {
		const rule = ruling(manifest, key);
		if (
			rule !== undefined &&
			running(rule.status) &&
			selects(`${tree.project}/${tree.name}`, entryId(key, 'test-unit-1'))
		)
			files.add(key.split(' > ')[0] ?? '');
	}
	const config = join(work, tree.source, '..', `vitest.${tree.name}.config.js`);
	const setup = join(work, 'packages', 'kit', 'test', 'matchers.js');
	const include = [...files].map((file) => join(work, tree.source, file));
	writeFileSync(
		config,
		`export default ${JSON.stringify({ test: { include, setupFiles: [setup], environment: 'node' } })};\n`
	);
	return {
		label: 'test-unit-1',
		kind: 'vitest',
		env: {},
		command: 'vitest',
		args: ['run', '-c', config, '--root', join(work, tree.source, '..'), '--passWithNoTests']
	};
}

function types(dir: string, report: string): void {
	const kit = realpathSync(join(target, 'node_modules', '@sveltejs', 'kit', 'types', 'index.d.ts'));
	const compilerOptions = {
		allowJs: true,
		checkJs: true,
		noEmit: true,
		allowImportingTsExtensions: true,
		target: 'esnext',
		module: 'nodenext',
		moduleResolution: 'nodenext',
		noUnusedLocals: true,
		noUnusedParameters: true,
		types: ['node']
	};
	const projects = [
		{ name: 'tsconfig.harness.json', include: ['*.test.ts'] },
		{ name: 'tsconfig.harness-enhanced.json', include: ['app-error-enhanced/*.test.ts'] }
	];
	for (const project of projects)
		writeFileSync(
			join(dir, project.name),
			JSON.stringify({ compilerOptions, files: [kit], include: project.include })
		);
	const tsrs = join(root, '..', 'node_modules', '.bin', 'tsrs');
	checkTypes(
		dir,
		projects.map((project) => ({
			cwd: dir,
			command: tsrs,
			args: ['--pretty', 'false', '-p', project.name]
		})),
		report
	);
}

const all = [...units(work), ...units(work, 'own')];

function chosen(unit: Unit): boolean {
	const id = `${unit.tree.project}/${unit.tree.name}`;
	if (!covers(id)) return false;
	const picks = selectors(id);
	if (picks === null || all.filter((other) => other.tree === unit.tree).length === 1) return true;
	return picks.some((pick) => pick === unit.app || pick.startsWith(`${unit.app}/`));
}

const variant = /\(([^()/]+-\d+)(?:\/[^()]*)?\)$/;

function labels(unit: Unit): ReadonlySet<string> | null {
	const picks = selectors(`${unit.tree.project}/${unit.tree.name}`);
	if (picks === null) return null;
	const found = new Set<string>();
	for (const pick of picks) {
		const label = variant.exec(pick)?.[1];
		if (label === undefined) return null;
		found.add(label);
	}
	return found;
}

function planned(dir: string, unit: Unit): Step[] {
	const chosen = labels(unit);
	if (chosen === null) return plan(dir, unit.scripts);
	const names = new Set([...chosen].map((label) => label.replace(/-\d+$/, '')));
	return plan(
		dir,
		unit.scripts.filter((script) => names.has(labelOf(script)))
	).filter((step) => step.label === null || chosen.has(step.label));
}

for (const unit of selected(all, process.argv.slice(2)).filter(chosen)) {
	const tree = unit.tree;
	const dir = join(work, unit.dir);
	if (tree.project === 'kit' && tree.name === 'types') {
		types(dir, join(results, reportName(unit, 'check-1')));
		runs.push({ tree, mode: 'check-1', file: reportName(unit, 'check-1'), env: {} });
		continue;
	}
	const steps = tree.name.endsWith('units') ? [specs(tree)] : planned(dir, unit);
	for (const step of steps) {
		console.log(`\n${tree.project}/${tree.name}/${unit.app} ${step.label ?? step.command}`);
		execute(step, {
			cwd: dir,
			path: [join(dir, 'node_modules', '.bin'), bin],
			env: {
				NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${force}`].filter(Boolean).join(' '),
				KIT_E2E_RETRIES: '2',
				pnpm_config_verify_deps_before_run: 'false',
				VIGLA_TREE: `${tree.project}/${tree.name}`,
				VIGLA_TARGET: basename(dirname(target)),
				VIGLA_STEP: step.label ?? ''
			},
			report: (label) => join(results, reportName(unit, label))
		});
		if (step.label === null) continue;
		runs.push({
			tree,
			mode: step.label,
			...(tree.name === 'build-errors' || tree.name.endsWith('units')
				? {}
				: { scope: `${unit.app}/` }),
			file: reportName(unit, step.label),
			env: {}
		});
	}
}
rmSync(work, { recursive: true, force: true });
writeRuns(results, runs);
