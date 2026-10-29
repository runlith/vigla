import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { load, ruling } from './manifest.ts';
import type { Variant } from './runtime/config.ts';
import { entryOfTest, suiteNamed, suiteOfFile, suites, type Suite } from './suites.ts';

interface Results {
	testResults: {
		name: string;
		assertionResults: { ancestorTitles: string[]; title: string; status: string }[];
	}[];
}

type Entry = { sample: string; variant?: Variant };

function key(entry: Entry): string {
	return entry.variant === undefined ? entry.sample : `${entry.sample} (${entry.variant})`;
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

const { positionals } = parseArgs({ allowPositionals: true });
const [upstreamFile, harnessFile, ...names] = positionals;
if (upstreamFile === undefined || harnessFile === undefined) {
	console.error('usage: compare.ts <upstream.json> <harness.json> [suite...]');
	process.exit(2);
}

let differences = 0;
for (const suite of names.length > 0 ? names.map(suiteNamed) : suites) {
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
