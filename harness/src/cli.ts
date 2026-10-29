import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { judge } from './judge.ts';
import { root } from './manifest.ts';
import { passingDir, readPassing, record } from './passing.ts';
import { matches, type Scope } from './scope.ts';
import { suiteId, suites } from './suites.ts';
import { trees } from './trees.ts';

const usage =
	'usage: cli.ts <target> [--passing] [--record] [--verbose] [--results <dir>] [<project>[/<suite>[/<entry>]] ...]';

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		passing: { type: 'boolean', default: false },
		record: { type: 'boolean', default: false },
		verbose: { type: 'boolean', default: false },
		results: { type: 'string' }
	}
});
const [where, ...picks] = positionals;
if (where === undefined) {
	console.error(usage);
	process.exit(2);
}
const target = resolve(where);
const passing = passingDir(target);
if ((values.passing || values.record) && passing === null) {
	console.error(
		`${relative(process.cwd(), target)} keeps no passing set: --passing and --record need one`
	);
	process.exit(2);
}

const ids = [
	...suites.map(suiteId),
	...trees.filter((tree) => tree.key !== 'none').map((tree) => `${tree.project}/${tree.name}`)
];

function chosen(): Map<string, string[] | null> | null {
	if (picks.length === 0) return null;
	const found = new Map<string, string[] | null>();
	for (const pick of picks) {
		const whole = ids.includes(pick) ? [pick] : ids.filter((id) => id.startsWith(`${pick}/`));
		if (whole.length > 0) {
			for (const id of whole) found.set(id, null);
			continue;
		}
		const suite = ids.find((id) => pick.startsWith(`${id}/`));
		if (suite === undefined) {
			console.error(`${pick} names no suite; suites: ${ids.join(', ')}`);
			process.exit(2);
		}
		const before = found.get(suite);
		if (before === null) continue;
		found.set(suite, [...(before ?? []), pick.slice(suite.length + 1)]);
	}
	return found;
}

const selection = chosen();
const recorded = passing === null ? null : readPassing(passing);
let scope: Scope | null = selection === null ? null : Object.fromEntries(selection);
if (values.passing && recorded !== null) {
	const narrowed: Record<string, string[]> = {};
	for (const [suite, set] of recorded) {
		if (selection !== null && !selection.has(suite)) continue;
		const within = selection?.get(suite) ?? null;
		const entries = [...set].filter(
			(entry) => within === null || within.some((pick) => matches(pick, entry))
		);
		if (entries.length > 0) narrowed[suite] = entries;
	}
	scope = narrowed;
	if (Object.keys(narrowed).length === 0) {
		console.log('no recorded entries to run');
		process.exit(0);
	}
}

const results =
	values.results === undefined
		? join(target, '.results', `run-${process.pid}`)
		: resolve(values.results);
mkdirSync(results, { recursive: true });
if (scope !== null) {
	const file = join(results, 'scope.json');
	writeFileSync(file, `${JSON.stringify(scope)}\n`);
	process.env.DROMON_SCOPE = file;
} else delete process.env.DROMON_SCOPE;
const env = process.env;

const wanted = (project: string): boolean =>
	scope === null || Object.keys(scope).some((id) => id.startsWith(`${project}/`));

const parts: string[] = [];
const exits: Record<string, number> = {};
const quiet = passing !== null && !values.verbose;

if (existsSync(join(target, 'vitest.config.ts')) && (wanted('svelte') || wanted('own'))) {
	const files =
		scope === null
			? []
			: suites
					.filter((suite) => suiteId(suite) in scope)
					.flatMap((suite) => suite.files.map((file) => `suites/${suite.project}/${file}`));
	const reporter = quiet ? join(root, 'src', 'report.ts') : 'dot';
	const outcome = spawnSync(
		join(target, 'node_modules', '.bin', 'vitest'),
		[
			'run',
			`--reporter=${reporter}`,
			'--reporter=json',
			`--outputFile.json=${join(results, 'svelte.json')}`,
			...files
		],
		{ cwd: target, stdio: 'inherit', env }
	);
	parts.push('svelte');
	exits.svelte = outcome.status ?? 1;
}

for (const part of ['vite-plugin', 'kit'] as const) {
	const dir = join(target, part);
	if (!existsSync(join(dir, 'package.json')) || !wanted(part)) continue;
	const outcome = spawnSync('node', [join(root, 'src', part, 'run.ts')], {
		cwd: dir,
		stdio: 'inherit',
		env: { ...env, DROMON_RESULTS: join(results, part) }
	});
	parts.push(part);
	exits[part] = outcome.status ?? 1;
}

if (passing !== null) delete exits.svelte;
const verdict = judge({ results, parts, passing: recorded, exits });

if (values.record && passing !== null) {
	for (const [suite, entries] of verdict.fresh) {
		record(passing, suite, entries);
		console.log(
			`recorded ${entries.length} in ${relative(process.cwd(), join(passing, `${suite}.txt`))}`
		);
	}
	if (verdict.fresh.size === 0) console.log('nothing newly passing to record');
} else if (verdict.fresh.size > 0)
	console.log('\nnewly passing entries are recorded with --record');

if (values.results === undefined) rmSync(results, { recursive: true, force: true });
console.log(
	`\n${relative(process.cwd(), target) || target}: ${verdict.failed ? 'failed' : 'passed'}`
);
process.exit(verdict.failed ? 1 : 0);
