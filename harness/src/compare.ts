import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { load, ruling } from './manifest.ts';
import { modeOf, outcomes } from './reports.ts';
import type { Variant } from './runtime/config.ts';
import { entryId, entryOfTest, suiteNamed, suiteOfFile, suites, type Suite } from './suites.ts';
import { treeNamed, trees, type Tree } from './trees.ts';

interface Results {
	testResults: {
		name: string;
		assertionResults: { ancestorTitles: string[]; title: string; status: string }[];
	}[];
}

type Entry = { sample: string; variant?: Variant };

function key(entry: Entry): string {
	return entryId(entry.sample, entry.variant);
}

function contractual(suite: Suite): (entry: Entry) => boolean {
	const manifest = load(suite.project, suite.name);
	return (entry) => ruling(manifest, entry.sample, entry.variant)?.status === 'contract';
}

function upstreamPassed(file: string, suite: Suite): Set<string> {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Results;
	const contract = contractual(suite);
	const found = new Set<string>();
	for (const module of results.testResults) {
		const path = module.name.replaceAll('\\', '/');
		for (const source of suite.upstream) {
			if (!path.endsWith(`/tests/${source.file}`)) continue;
			for (const test of module.assertionResults) {
				if (test.status !== 'passed') continue;
				const [outer, ...inner] = test.ancestorTitles;
				if (source.describe !== undefined && outer !== source.describe) continue;
				const titles = source.describe === undefined ? test.ancestorTitles : inner;
				const title = suite.kind === 'units' ? [...titles, test.title].join(' > ') : test.title;
				const entry = source.entry(title);
				if (entry !== null && contract(entry)) found.add(key(entry));
			}
		}
	}
	return found;
}

function harnessPassed(file: string, suite: Suite): Set<string> {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Results;
	const contract = contractual(suite);
	const found = new Set<string>();
	for (const module of results.testResults) {
		if (suiteOfFile(module.name)?.name !== suite.name) continue;
		for (const test of module.assertionResults) {
			if (test.status !== 'passed') continue;
			const entry: Entry | null = entryOfTest(suite, test.ancestorTitles, test.title);
			if (entry !== null && contract(entry)) found.add(key(entry));
		}
	}
	return found;
}

function treePassed(tree: Tree, file: string, mode: string | undefined): Set<string> {
	const manifest = load(tree.project, tree.name);
	const found = new Set<string>();
	for (const { key, state, variant } of outcomes(tree, file, mode) ?? []) {
		if (state === 'passed' && ruling(manifest, key, variant)?.status === 'contract')
			found.add(entryId(key, variant));
	}
	return found;
}

function compareTrees(
	upstreamDir: string,
	harnessDir: string,
	selected: readonly string[]
): number {
	let differences = 0;
	const chosen =
		selected.length > 0
			? selected.map((name) => {
					const [project = '', tree = ''] = name.split('/');
					const found = treeNamed(project, tree);
					if (found === undefined) throw new Error(`no tree ${name}`);
					return found;
				})
			: trees;
	for (const tree of chosen) {
		if (tree.project === 'own') continue;
		const reports = readdirSync(upstreamDir).filter(
			(file) =>
				file === `${tree.name}.json` || (file.startsWith(`${tree.name}.`) && file.endsWith('.json'))
		);
		for (const report of reports.sort()) {
			const mode = modeOf(tree, report);
			const harnessReport = join(harnessDir, report);
			if (!existsSync(harnessReport)) {
				console.log(`${tree.project}/${tree.name} ${report}: no harness report`);
				differences++;
				continue;
			}
			const upstream = treePassed(tree, join(upstreamDir, report), mode);
			const harness = treePassed(tree, harnessReport, mode);
			const onlyUpstream = [...upstream].filter((key) => !harness.has(key));
			const onlyHarness = [...harness].filter((key) => !upstream.has(key));
			console.log(
				`${tree.project}/${tree.name} ${report}: ${upstream.size} contract entries pass upstream's runner, ${harness.size} the harness`
			);
			for (const key of onlyUpstream) console.log(`  only upstream: ${key}`);
			for (const key of onlyHarness) console.log(`  only harness: ${key}`);
			differences += onlyUpstream.length + onlyHarness.length;
		}
	}
	return differences > 0 ? 1 : 0;
}

const { positionals } = parseArgs({ allowPositionals: true });
const [upstreamFile, harnessFile, ...names] = positionals;
if (upstreamFile === undefined || harnessFile === undefined) {
	console.error('usage: compare.ts <upstream.json> <harness.json> [suite...]');
	process.exit(2);
}
if (statSync(upstreamFile).isDirectory())
	process.exit(compareTrees(upstreamFile, harnessFile, names));

let differences = 0;
for (const suite of names.length > 0
	? names.map(suiteNamed)
	: suites.filter((suite) => suite.upstream.length > 0)) {
	const upstream = upstreamPassed(upstreamFile, suite);
	const harness = harnessPassed(harnessFile, suite);
	const onlyUpstream = [...upstream].filter((name) => !harness.has(name));
	const onlyHarness = [...harness].filter((name) => !upstream.has(name));
	console.log(
		`${suite.project}/${suite.name}: ${upstream.size} contract entries pass upstream's runner, ${harness.size} the harness`
	);
	for (const name of onlyUpstream) console.log(`  only upstream: ${name}`);
	for (const name of onlyHarness) console.log(`  only harness: ${name}`);
	differences += onlyUpstream.length + onlyHarness.length;
}
process.exit(differences > 0 ? 1 : 0);
