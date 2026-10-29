import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { load, root } from './manifest.ts';
import { suiteNamed } from './suites.ts';
import { repositories, samplesOf, treeFiles, treeNamed, type Tree } from './trees.ts';

const sources: Record<string, string> = {
	svelte: join(root, '..', '.external', 'svelte', 'packages', 'svelte', 'tests')
};

const rewrites = JSON.parse(readFileSync(join(root, 'rewrites.json'), 'utf8')) as Record<
	string,
	string
>;

const specifier = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g;

export function rewrite(text: string): string {
	return text.replace(specifier, (whole, lead: string, quote: string, path: string) => {
		const replacement = rewrites[path];
		return replacement === undefined ? whole : `${lead}${quote}${replacement}${quote}`;
	});
}

function files(dir: string): string[] {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(dir, join(entry.parentPath, entry.name)))
		.sort();
}

function expected(source: string): Map<string, string> {
	const result = new Map<string, string>();
	for (const file of files(source))
		result.set(file, rewrite(readFileSync(join(source, file), 'utf8')));
	return result;
}

function differs(dest: string, wanted: Map<string, string>): string[] {
	if (!existsSync(dest)) return ['missing'];
	const found: string[] = [];
	const present = files(dest);
	for (const file of present) if (!wanted.has(file)) found.push(`extra ${file}`);
	for (const [file, text] of wanted) {
		if (!present.includes(file)) found.push(`missing ${file}`);
		else if (readFileSync(join(dest, file), 'utf8') !== text) found.push(`changed ${file}`);
	}
	return found;
}

function copyTree(tree: Tree, check: boolean): number {
	const from = join(repositories[tree.project], tree.source);
	const to = samplesOf(tree);
	const conversions = load(tree.project, tree.name).conversions ?? {};
	const problems: string[] = [];
	const upstream = treeFiles(from, tree.exclude);
	const present = existsSync(to) ? treeFiles(to) : [];
	for (const file of upstream) {
		const wanted = readFileSync(join(from, file));
		const dest = join(to, file);
		const same = existsSync(dest) && readFileSync(dest).equals(wanted);
		if (file in conversions) {
			if (check && same) problems.push(`${file}: converted in the manifest but equal to upstream`);
			continue;
		}
		if (same) continue;
		if (check) problems.push(`${file}: ${existsSync(dest) ? 'changed' : 'missing'}`);
		else {
			mkdirSync(dirname(dest), { recursive: true });
			writeFileSync(dest, wanted);
		}
	}
	for (const file of present) {
		if (upstream.includes(file) || file in conversions) continue;
		if (check) problems.push(`${file}: not an upstream file`);
		else rmSync(join(to, file));
	}
	for (const file of Object.keys(conversions)) {
		if (!upstream.includes(file) && !present.includes(file))
			problems.push(`${file}: converted in the manifest but neither upstream nor copied`);
	}
	for (const problem of problems) console.error(`${tree.project}/${tree.name}: ${problem}`);
	return problems.length > 0 ? 1 : 0;
}

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { check: { type: 'boolean', default: false } }
});
const [project = 'svelte', suite] = positionals;
const tree = suite === undefined ? undefined : treeNamed(project, suite);
if (tree !== undefined) process.exit(copyTree(tree, values.check ?? false));
const base = sources[project];
if (suite === undefined || base === undefined) {
	console.error('usage: copy.ts [--check] <project> <suite>');
	process.exit(2);
}

const { kind, source } = suiteNamed(suite);
const from = join(base, source);
const to = join(root, 'samples', project, suite);
const problems: string[] = [];

if (kind === 'units') {
	const wanted = statSync(from).isFile()
		? new Map([[basename(from), rewrite(readFileSync(from, 'utf8'))]])
		: expected(from);
	const changes = differs(to, wanted);
	if (changes.length > 0 && values.check) problems.push(`${suite}: ${changes.join(', ')}`);
	else if (changes.length > 0) {
		rmSync(to, { recursive: true, force: true });
		for (const [file, text] of wanted) {
			mkdirSync(dirname(join(to, file)), { recursive: true });
			writeFileSync(join(to, file), text);
		}
	}
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}

const manifest = load(project, suite);
const upstream = readdirSync(from)
	.filter((name) => !name.startsWith('.'))
	.sort();

for (const name of upstream) {
	const entry = manifest.samples[name];
	if (entry === undefined) problems.push(`${name}: no status in the manifest`);
	const wanted = expected(join(from, name));
	const dest = join(to, name);
	const converted = entry !== undefined && entry !== 'contract' && entry.status === 'converted';
	const changes = differs(dest, wanted);
	if (converted) {
		if (changes.length === 0)
			problems.push(`${name}: converted in the manifest but equal to upstream`);
		continue;
	}
	if (changes.length === 0) continue;
	if (values.check) {
		problems.push(`${name}: ${changes.join(', ')}`);
		continue;
	}
	rmSync(dest, { recursive: true, force: true });
	for (const [file, text] of wanted) {
		mkdirSync(dirname(join(dest, file)), { recursive: true });
		writeFileSync(join(dest, file), text);
	}
}

if (existsSync(to)) {
	for (const name of readdirSync(to)) {
		if (upstream.includes(name)) continue;
		if (values.check) problems.push(`${name}: not an upstream sample`);
		else rmSync(join(to, name), { recursive: true, force: true });
	}
}
const tests = suiteNamed(suite).tests ?? [];
for (const name of Object.keys(manifest.samples)) {
	if (!upstream.includes(name) && !tests.includes(name))
		problems.push(`${name}: in the manifest but not upstream`);
}
for (const name of tests) {
	if (manifest.samples[name] === undefined) problems.push(`${name}: no status in the manifest`);
}

for (const problem of problems) console.error(problem);
process.exit(problems.length > 0 ? 1 : 0);
