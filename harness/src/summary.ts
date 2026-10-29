import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faults, load, ruling, runs as running, statuses } from './manifest.ts';
import { entryOfTree, type Tree } from './trees.ts';

export interface Run {
	tree: Tree;
	mode?: string;
	file: string;
	env: Record<string, string>;
}

export interface Outcome {
	key: string;
	state: string;
}

interface Vitest {
	testResults: {
		name: string;
		status: string;
		message?: string;
		assertionResults: { ancestorTitles: string[]; title: string; status: string }[];
	}[];
}

export function outcomes(tree: Tree, file: string): Outcome[] | null {
	if (!existsSync(file)) return null;
	const results = JSON.parse(readFileSync(file, 'utf8')) as Vitest;
	const found: Outcome[] = [];
	for (const module of results.testResults) {
		for (const test of module.assertionResults) {
			const key = entryOfTree(tree, module.name, test.ancestorTitles, test.title);
			if (key !== null) found.push({ key, state: test.status });
		}
	}
	return found;
}

function broken(file: string): string[] {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Vitest;
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
		const found = outcomes(run.tree, file);
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
		for (const { key, state } of found) {
			keys.add(key);
			const status = ruling(manifest, key, run.mode)?.status ?? 'unruled';
			if (status === 'unruled' || state === 'failed') failures++;
			counts.set(`${status} ${state}`, (counts.get(`${status} ${state}`) ?? 0) + 1);
		}
		const reported = new Set(found.map((outcome) => outcome.key));
		for (const key of Object.keys(manifest.samples)) {
			if (reported.has(key)) continue;
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
		const missing = Object.keys(manifest.samples).filter((key) => {
			if (keys.has(key)) return false;
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
