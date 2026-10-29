import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faults, load, ruling, runs as running, statuses } from './manifest.ts';
import { entryOfTree, type Tree } from './trees.ts';

export interface Run {
	tree: Tree;
	mode?: string;
	scope?: string;
	file: string;
	env: Record<string, string>;
}

export interface Outcome {
	key: string;
	state: string;
	variant: string | undefined;
}

interface Vitest {
	testResults: {
		name: string;
		status: string;
		message?: string;
		assertionResults: { ancestorTitles: string[]; title: string; status: string }[];
	}[];
}

interface Spec {
	title: string;
	file: string;
	tests: { projectName: string; status: string; expectedStatus: string }[];
}

interface Group {
	title: string;
	specs?: Spec[];
	suites?: Group[];
}

interface Playwright {
	config: { rootDir: string };
	suites: Group[];
	errors?: { message?: string }[];
}

const played: Readonly<Record<string, string>> = {
	expected: 'passed',
	flaky: 'passed',
	unexpected: 'failed',
	skipped: 'skipped'
};

function walk(
	tree: Tree,
	report: Playwright,
	group: Group,
	path: string[],
	mode: string | undefined,
	into: Outcome[]
): void {
	for (const spec of group.specs ?? []) {
		const key = entryOfTree(tree, join(report.config.rootDir, spec.file), path, spec.title);
		if (key === null) continue;
		for (const test of spec.tests) {
			const state =
				test.status === 'expected' && test.expectedStatus === 'skipped'
					? 'skipped'
					: (played[test.status] ?? test.status);
			into.push({ key, state, variant: `${mode ?? ''}/${test.projectName}` });
		}
	}
	for (const inner of group.suites ?? [])
		walk(tree, report, inner, [...path, inner.title], mode, into);
}

export function modeOf(tree: Tree, report: string): string | undefined {
	const rest = report.slice(tree.name.length + 1, -'.json'.length);
	if (rest === '') return undefined;
	return tree.project === 'kit' ? rest.slice(rest.indexOf('.') + 1) : rest;
}

export function outcomes(tree: Tree, file: string, mode: string | undefined): Outcome[] | null {
	if (!existsSync(file)) return null;
	const results = JSON.parse(readFileSync(file, 'utf8')) as Vitest | Playwright;
	const found: Outcome[] = [];
	if ('suites' in results) {
		for (const group of results.suites) walk(tree, results, group, [], mode, found);
		return found;
	}
	for (const module of results.testResults) {
		for (const test of module.assertionResults) {
			const key = entryOfTree(tree, module.name, test.ancestorTitles, test.title);
			if (key !== null) found.push({ key, state: test.status, variant: mode });
		}
	}
	return found;
}

function broken(file: string): string[] {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Vitest | Playwright;
	if ('suites' in results)
		return (results.errors ?? []).map((error) => (error.message ?? '').split('\n')[0] ?? '');
	return results.testResults
		.filter((module) => module.status === 'failed' && module.assertionResults.length === 0)
		.map((module) => `${module.name}: ${(module.message ?? '').split('\n')[0]}`);
}

export function summarize(runs: readonly Run[], dir: string): number {
	let failures = 0;
	const seen = new Map<string, Set<string>>();
	for (const run of runs) {
		const name = `${run.tree.project}/${run.tree.name}`;
		const manifest = load(run.tree.project, run.tree.name);
		const file = join(dir, run.file);
		const found = outcomes(run.tree, file, run.mode);
		console.log(`\n${name}${run.mode === undefined ? '' : ` (${run.mode})`}`);
		if (found === null) {
			console.log('  no report');
			failures++;
			continue;
		}
		for (const problem of broken(file)) {
			console.log(`  file failed: ${problem}`);
			failures++;
		}
		const keys = seen.get(name) ?? new Set<string>();
		seen.set(name, keys);
		const counts = new Map<string, number>();
		for (const { key, state, variant } of found) {
			keys.add(key);
			const status = ruling(manifest, key, variant)?.status ?? 'unruled';
			if (status === 'unruled') console.log(`  unruled: ${key} (${variant})`);
			if (status === 'unruled' || state === 'failed') failures++;
			counts.set(`${status} ${state}`, (counts.get(`${status} ${state}`) ?? 0) + 1);
		}
		const reported = new Set(found.map((outcome) => outcome.key));
		for (const key of Object.keys(manifest.samples)) {
			if (reported.has(key) || (run.scope !== undefined && !key.startsWith(run.scope))) continue;
			const status = ruling(manifest, key, run.mode)?.status ?? 'unruled';
			counts.set(`${status} unloaded`, (counts.get(`${status} unloaded`) ?? 0) + 1);
		}
		for (const status of [...statuses, 'unruled']) {
			const cells = ['passed', 'failed', 'skipped', 'pending', 'unloaded']
				.map((state) => [state, counts.get(`${status} ${state}`) ?? 0] as const)
				.filter(([, count]) => count > 0)
				.map(([state, count]) => `${count} ${state}`);
			if (cells.length > 0) console.log(`  ${status}: ${cells.join(', ')}`);
		}
	}
	for (const [name, keys] of seen) {
		const [project = '', tree = ''] = name.split('/');
		const manifest = load(project, tree);
		const problems = faults(manifest);
		const scopes = runs
			.filter((run) => `${run.tree.project}/${run.tree.name}` === name)
			.map((run) => run.scope);
		const covered = (key: string): boolean =>
			scopes.some((scope) => scope === undefined || key.startsWith(scope));
		const missing = Object.keys(manifest.samples).filter((key) => {
			if (keys.has(key) || !covered(key)) return false;
			const rule = ruling(manifest, key);
			return rule !== undefined && running(rule.status);
		});
		for (const problem of problems) console.log(`${name}: ${problem}`);
		for (const key of missing)
			console.log(`${name}: ${key} runs by its status but no run reported it`);
		failures += problems.length + missing.length;
	}
	return failures > 0 ? 1 : 0;
}
