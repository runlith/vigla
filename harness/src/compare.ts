import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { load, ruling } from './manifest.ts';
import type { Variant } from './runtime/config.ts';

interface Results {
	testResults: { assertionResults: { title: string; status: string }[] }[];
}

const title = /^(.*) \((dom|hydrate|ssr|async-ssr)\)$/;

function passed(file: string, contract: (name: string) => boolean): Set<string> {
	const results = JSON.parse(readFileSync(file, 'utf8')) as Results;
	const found = new Set<string>();
	for (const module of results.testResults) {
		for (const test of module.assertionResults) {
			if (test.status === 'passed' && contract(test.title)) found.add(test.title);
		}
	}
	return found;
}

const { positionals } = parseArgs({ allowPositionals: true });
const [upstreamFile, harnessFile, project = 'svelte', suite = 'runtime-runes'] = positionals;
if (upstreamFile === undefined || harnessFile === undefined) {
	console.error('usage: compare.ts <upstream.json> <harness.json> [project] [suite]');
	process.exit(2);
}

const manifest = load(project, suite);
const contract = (name: string): boolean => {
	const match = title.exec(name);
	if (match === null) return false;
	return ruling(manifest, match[1] ?? '', match[2] as Variant)?.status === 'contract';
};

const upstream = passed(upstreamFile, contract);
const harness = passed(harnessFile, contract);
const onlyUpstream = [...upstream].filter((name) => !harness.has(name));
const onlyHarness = [...harness].filter((name) => !upstream.has(name));

console.log(
	`${project}/${suite}: ${upstream.size} contract entries pass upstream's runner, ${harness.size} the harness`
);
for (const name of onlyUpstream) console.log(`  only upstream: ${name}`);
for (const name of onlyHarness) console.log(`  only harness: ${name}`);
process.exit(onlyUpstream.length + onlyHarness.length > 0 ? 1 : 0);
