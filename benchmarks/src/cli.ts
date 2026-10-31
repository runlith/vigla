import { execFileSync, fork } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { prepare, type Prepared, type Target } from './prepare.ts';
import type { Listed, Measured } from './protocol.ts';

interface Row extends Listed {
	readonly times: Record<string, number[]>;
	readonly failed?: string;
}

const base = resolve(import.meta.dirname, '..');
const repo = resolve(base, '..');
const suites = ['reactivity', 'own'];
const targets: Target[] = [
	{ name: 'upstream', root: join(repo, 'targets', 'upstream') },
	{ name: 'vigla', root: join(repo, 'targets', 'vigla') }
];

let runs = 10;
const filters: string[] = [];
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
	const arg = args[index] as string;
	if (arg === '--runs') runs = Number(args[++index]);
	else filters.push(arg);
}
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs takes a positive integer');

function child<T>(target: Prepared, label: string | undefined): Promise<T> {
	return new Promise((done, failed) => {
		const env: NodeJS.ProcessEnv = { ...process.env, BENCH_INDEX: target.index };
		if (label === undefined) delete env.BENCH_LABEL;
		else env.BENCH_LABEL = label;
		const spawned = fork(join(import.meta.dirname, 'child.ts'), [], {
			execArgv: ['--expose-gc', '--conditions=browser', '--conditions=production'],
			env
		});
		let result: T | null = null;
		spawned.on('message', (message) => (result = message as T));
		spawned.on('error', failed);
		spawned.on('exit', (code, signal) => {
			if (code !== 0 || result === null)
				failed(new Error(`${target.name} ${label ?? 'list'} exited with ${code ?? signal}`));
			else done(result);
		});
	});
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = sorted.length >> 1;
	return sorted.length % 2 === 1
		? (sorted[middle] as number)
		: ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function cell(values: readonly number[]): string {
	const low = Math.min(...values).toFixed(2);
	const high = Math.max(...values).toFixed(2);
	return `${median(values).toFixed(2)} (${low}–${high})`;
}

function revision(): string {
	const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo })
		.toString()
		.trim();
	const dirty = execFileSync('git', ['status', '--porcelain', '--', 'packages'], { cwd: repo })
		.toString()
		.trim();
	return dirty === '' ? head : `${head} with uncommitted packages changes`;
}

const prepared: Prepared[] = [];
for (const target of targets) prepared.push(await prepare(target, base, suites));

const listed = await child<Listed[]>(prepared[0] as Prepared, undefined);
const selected = listed.filter(
	(entry) =>
		filters.length === 0 ||
		filters.some((filter) => `${entry.suite}/${entry.label}`.includes(filter))
);
if (selected.length === 0) throw new Error('no benchmark matches the filters');

const machine = `${cpus().length} × ${cpus()[0]?.model ?? 'unknown cpu'}, node ${process.version}`;
const loadStart = loadavg()[0] as number;
console.log(`${machine}; vigla at ${revision()}; ${runs} runs per target, alternating`);
console.log(`load average at start: ${loadStart.toFixed(2)}\n`);

const widths = [36, 26, 26, 8];
const line = (cells: readonly string[]): string =>
	cells
		.map((text, index) =>
			index === 0 ? text.padEnd(widths[0] as number) : text.padStart(widths[index] as number)
		)
		.join('');
console.log(line(['benchmark', 'upstream ms', 'vigla ms', 'ratio']));
console.log('='.repeat(widths.reduce((a, b) => a + b)));

const rows: Row[] = [];
for (const entry of selected) {
	const times: Record<string, number[]> = {};
	for (const target of prepared) times[target.name] = [];
	try {
		for (let run = 0; run < runs; run++) {
			const order = run % 2 === 0 ? prepared : [...prepared].reverse();
			for (const target of order) {
				const measured = await child<Measured>(target, entry.label);
				times[target.name]?.push(measured.time);
			}
		}
	} catch (error) {
		process.exitCode = 1;
		rows.push({ ...entry, times, failed: String(error) });
		console.log(line([`${entry.suite}/${entry.label}`, 'failed:', String(error), '']));
		continue;
	}
	rows.push({ ...entry, times });
	const upstream = times.upstream as number[];
	const vigla = times.vigla as number[];
	const ratio = (median(vigla) / median(upstream)).toFixed(2);
	console.log(line([`${entry.suite}/${entry.label}`, cell(upstream), cell(vigla), ratio]));
}

const loadEnd = loadavg()[0] as number;
console.log(`\nload average at end: ${loadEnd.toFixed(2)} on ${cpus().length} cpus`);

const results = join(base, '.results');
mkdirSync(results, { recursive: true });
const file = join(results, `${new Date().toISOString().replaceAll(':', '-')}.json`);
writeFileSync(
	file,
	JSON.stringify(
		{ machine, revision: revision(), runs, load: [loadStart, loadEnd], rows },
		null,
		'\t'
	)
);
console.log(`raw runs written to ${file}`);
