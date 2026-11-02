import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryOfTest, suiteId, suiteOfFile } from './suites.ts';
import { entryOfTree, treeNamed, type Tree } from './trees.ts';

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
	message?: string;
}

export interface Result extends Outcome {
	suite: string;
}

interface Vitest {
	testResults: {
		name: string;
		status: string;
		message?: string;
		assertionResults: {
			ancestorTitles: string[];
			title: string;
			status: string;
			failureMessages?: string[];
		}[];
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

export function resultsDir(target: string): string {
	return process.env.VIGLA_RESULTS ?? join(target, '.results', `run-${process.pid}`);
}

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
	const prefix = tree.project === 'own' ? `${tree.project}.` : '';
	const rest = report.slice(prefix.length + tree.name.length + 1, -'.json'.length);
	if (rest === '') return undefined;
	return tree.runner === 'kit' ? rest.slice(rest.indexOf('.') + 1) : rest;
}

function firstLine(messages: readonly string[] | undefined): string | undefined {
	const first = messages?.find((message) => message.trim() !== '');
	return first?.trim().split('\n')[0];
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
			if (key === null) continue;
			const message = firstLine(test.failureMessages);
			found.push({
				key,
				state: test.status,
				variant: mode,
				...(message === undefined ? {} : { message })
			});
		}
	}
	return found;
}

export function broken(file: string): string[] {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Vitest | Playwright;
	if ('suites' in results)
		return (results.errors ?? []).map((error) => (error.message ?? '').split('\n')[0] ?? '');
	return results.testResults
		.filter((module) => module.status === 'failed' && module.assertionResults.length === 0)
		.map((module) => `${module.name}: ${(module.message ?? '').split('\n')[0]}`);
}

export interface Suites {
	results: Result[];
	faults: string[];
	files: string[];
}

export function suiteResults(file: string): Suites {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Vitest;
	const found: Suites = { results: [], faults: [], files: broken(file) };
	for (const module of results.testResults) {
		const suite = suiteOfFile(module.name);
		if (suite === undefined) continue;
		for (const test of module.assertionResults) {
			const message = firstLine(test.failureMessages);
			if (test.title === 'manifest' && test.ancestorTitles.length === 0) {
				if (test.status === 'failed') found.faults.push(`${suiteId(suite)}: manifest: ${message}`);
				continue;
			}
			const entry = entryOfTest(suite, test.ancestorTitles, test.title);
			if (entry === null) continue;
			found.results.push({
				suite: suiteId(suite),
				key: entry.sample,
				variant: entry.variant,
				state: test.status,
				...(message === undefined ? {} : { message })
			});
		}
	}
	return found;
}

interface Index {
	tree: string;
	mode?: string;
	scope?: string;
	file: string;
}

export function writeRuns(dir: string, runs: readonly Run[]): void {
	const index: Index[] = runs.map((run) => ({
		tree: `${run.tree.project}/${run.tree.name}`,
		...(run.mode === undefined ? {} : { mode: run.mode }),
		...(run.scope === undefined ? {} : { scope: run.scope }),
		file: run.file
	}));
	writeFileSync(join(dir, 'runs.json'), `${JSON.stringify(index, null, '\t')}\n`);
}

export function readRuns(dir: string): Run[] | null {
	const file = join(dir, 'runs.json');
	if (!existsSync(file)) return null;
	return (JSON.parse(readFileSync(file, 'utf8')) as Index[]).map((entry) => {
		const [project = '', name = ''] = entry.tree.split('/');
		const tree = treeNamed(project, name);
		if (tree === undefined) throw new Error(`runs.json names no tree ${entry.tree}`);
		return {
			tree,
			...(entry.mode === undefined ? {} : { mode: entry.mode }),
			...(entry.scope === undefined ? {} : { scope: entry.scope }),
			file: entry.file,
			env: {}
		};
	});
}
