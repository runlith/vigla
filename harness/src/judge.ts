import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	faults,
	load,
	provesDifferences,
	ruling,
	runs as running,
	runsOn,
	statuses,
	type Manifest
} from './manifest.ts';
import { broken, outcomes, readRuns, suiteResults, type Result } from './reports.ts';
import { covers, matches, reaches, selectors, selects } from './scope.ts';
import { entryId, suiteId, suites } from './suites.ts';
import { trees } from './trees.ts';

export interface Verdict {
	failed: boolean;
	fresh: Map<string, string[]>;
}

export interface Judgement {
	target: string;
	results: string;
	parts: readonly string[];
	passing: Map<string, Set<string>> | null;
	exits: Readonly<Record<string, number>>;
}

const order = [
	...suites.map(suiteId),
	...trees.filter((tree) => tree.key !== 'none').map((tree) => `${tree.project}/${tree.name}`)
];

const states = ['passed', 'failed', 'skipped', 'pending', 'todo', 'unloaded'];

interface Seen {
	ran: boolean;
	failed: boolean;
	runs: boolean;
	upstream: boolean;
	proof?: true;
	message?: string;
}

function passed(seen: Seen): boolean {
	return seen.ran && !seen.failed;
}

export function judge(judgement: Judgement): Verdict {
	const progress = judgement.passing !== null;
	const proving = judgement.target === 'upstream' && provesDifferences();
	const results: Result[] = [];
	const errors: string[] = [];
	const loading: string[] = [];
	const unloaded = new Map<string, number>();
	const manifests = new Map<string, Manifest>();
	const manifest = (suite: string): Manifest => {
		let found = manifests.get(suite);
		if (found === undefined) {
			const [project = '', name = ''] = suite.split('/');
			found = load(project, name);
			manifests.set(suite, found);
		}
		return found;
	};

	for (const [part, code] of Object.entries(judgement.exits))
		if (code !== 0) (progress ? loading : errors).push(`${part} exited with ${code}`);

	if (judgement.parts.includes('svelte')) {
		const file = join(judgement.results, 'svelte.json');
		if (!existsSync(file)) errors.push('svelte: no report');
		else {
			const found = suiteResults(file);
			results.push(...found.results);
			errors.push(...found.faults);
			loading.push(...found.files);
		}
	}

	for (const part of judgement.parts) {
		if (part === 'svelte') continue;
		const dir = join(judgement.results, part);
		const runs = readRuns(dir);
		if (runs === null) {
			errors.push(`${part}: no runs index`);
			continue;
		}
		const reported = new Map<string, Set<string>>();
		for (const run of runs) {
			const suite = `${run.tree.project}/${run.tree.name}`;
			const file = join(dir, run.file);
			const found = outcomes(run.tree, file, run.mode);
			if (found === null) {
				errors.push(`${suite} (${run.mode ?? 'run'}): no report`);
				continue;
			}
			for (const problem of broken(file)) loading.push(`${suite}: ${problem}`);
			const keys = reported.get(suite) ?? new Set<string>();
			reported.set(suite, keys);
			for (const outcome of found) {
				keys.add(outcome.key);
				results.push({ suite, ...outcome });
			}
		}
		for (const [suite, keys] of reported) {
			for (const problem of faults(manifest(suite))) errors.push(`${suite}: ${problem}`);
			const scoped = selectors(suite) !== null;
			const scopes = runs
				.filter((run) => `${run.tree.project}/${run.tree.name}` === suite)
				.map((run) => run.scope);
			for (const key of Object.keys(manifest(suite).samples)) {
				if (keys.has(key)) continue;
				if (!scopes.some((scope) => scope === undefined || key.startsWith(scope))) continue;
				const rule = ruling(manifest(suite), key);
				if (
					proving &&
					rule?.status === 'difference' &&
					suite.startsWith('own/') &&
					reaches(suite, key)
				)
					errors.push(`${suite}/${key} did not run on ${judgement.target}`);
				if (scoped) continue;
				const cell = `${suite}\n${rule?.status ?? 'unruled'} unloaded`;
				unloaded.set(cell, (unloaded.get(cell) ?? 0) + 1);
				if (!progress && rule !== undefined && running(rule.status))
					errors.push(`${suite}: ${key} runs by its status but no run reported it`);
			}
		}
	}

	const counts = new Map<string, number>(unloaded);
	const entries = new Map<string, Map<string, Seen>>();
	for (const result of results) {
		const id = entryId(result.key, result.variant);
		if (!selects(result.suite, id)) continue;
		const status = ruling(manifest(result.suite), result.key, result.variant)?.status ?? 'unruled';
		const runs =
			status !== 'unruled' && runsOn(status, result.suite.split('/')[0] ?? '', judgement.target);
		const upstream = runs && result.upstream === true;
		const cell = `${result.suite}\n${status} ${result.state}`;
		if (!upstream) counts.set(cell, (counts.get(cell) ?? 0) + 1);
		if (status === 'unruled') errors.push(`${result.suite}: ${id} has no status in the manifest`);
		const byId = entries.get(result.suite) ?? new Map<string, Seen>();
		entries.set(result.suite, byId);
		const before = byId.get(id);
		const ran = result.state === 'passed' || result.state === 'failed';
		const failed = result.state === 'failed' || (before?.failed ?? false);
		const message = (result.state === 'failed' ? result.message : undefined) ?? before?.message;
		const proof = proving && status === 'difference' && result.suite.startsWith('own/');
		byId.set(id, {
			ran: ran || (before?.ran ?? false),
			failed,
			runs,
			upstream: upstream && (before?.upstream ?? true),
			...(proof ? { proof } : {}),
			...(message === undefined ? {} : { message })
		});
		if (!progress && !proof && result.state === 'failed')
			errors.push(`${result.suite}/${id} failed${result.message ? `: ${result.message}` : ''}`);
	}

	for (const suite of order) {
		const picks = covers(suite) ? selectors(suite) : null;
		const ids = [...(entries.get(suite)?.keys() ?? [])];
		for (const pick of picks ?? []) {
			if (judgement.passing?.get(suite)?.has(pick)) continue;
			if (!ids.some((id) => matches(pick, id))) errors.push(`${suite}/${pick} selects no entry`);
		}
	}

	const fresh = new Map<string, string[]>();
	const recorded = new Map<string, { total: number; failing: number }>();
	if (judgement.passing !== null) {
		const named = new Set([...judgement.passing.keys(), ...entries.keys()]);
		for (const suite of named) {
			if (!covers(suite)) continue;
			const set = judgement.passing.get(suite) ?? new Set<string>();
			const byId = entries.get(suite) ?? new Map();
			let total = 0;
			let failing = 0;
			for (const id of set) {
				if (!selects(suite, id)) continue;
				total++;
				const entry = byId.get(id);
				const problem =
					entry === undefined
						? 'recorded, not reported'
						: entry.upstream
							? 'recorded, skipped by upstream'
							: !entry.runs
								? 'recorded, does not run by its status'
								: passed(entry)
									? null
									: `recorded, failed${entry.message ? `: ${entry.message}` : ''}`;
				if (problem === null) continue;
				failing++;
				errors.push(`${suite}/${id} ${problem}`);
			}
			recorded.set(suite, { total, failing });
			const newly = [...byId]
				.filter(([id, entry]) => passed(entry) && entry.runs && !set.has(id))
				.map(([id]) => id)
				.sort();
			if (newly.length > 0) fresh.set(suite, newly);
		}
	}

	const shown = new Set([...entries.keys(), ...recorded.keys()]);
	for (const cell of counts.keys()) shown.add(cell.split('\n')[0] ?? '');
	const sorted = [...shown].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
	for (const suite of sorted) {
		console.log(`\n${suite}`);
		for (const status of [...statuses, 'unruled']) {
			const cells = states
				.map((state) => [state, counts.get(`${suite}\n${status} ${state}`) ?? 0] as const)
				.filter(([, count]) => count > 0)
				.map(([state, count]) => `${count} ${state}`);
			if (cells.length > 0) console.log(`  ${status}: ${cells.join(', ')}`);
		}
		const upstream = [...(entries.get(suite)?.values() ?? [])].filter((entry) => entry.upstream);
		if (upstream.length > 0) console.log(`  skipped by upstream: ${upstream.length}`);
		const mark = recorded.get(suite);
		if (mark !== undefined) {
			const failing = mark.failing > 0 ? ` (${mark.failing} failing)` : '';
			console.log(
				`  recorded: ${mark.total}${failing}, newly passing: ${fresh.get(suite)?.length ?? 0}`
			);
		}
	}

	if (proving) {
		const proofs = [...entries].flatMap(([suite, byId]) =>
			[...byId]
				.filter(([, entry]) => entry.proof)
				.map(([id, entry]) => ({ id: `${suite}/${id}`, entry }))
		);
		console.log(`\nown differences on ${judgement.target}: ${proofs.length}`);
		for (const { id, entry } of proofs) {
			if (entry.ran && entry.failed) {
				console.log(`  red, the expected proof: ${id}${entry.message ? `: ${entry.message}` : ''}`);
				continue;
			}
			const problem = entry.ran ? 'green, its defect does not reproduce' : 'did not run';
			console.log(`  ${problem}: ${id}`);
			errors.push(`${id} ${problem} on ${judgement.target}`);
		}
	}

	if (loading.length > 0) {
		console.log(progress ? '\nnot loaded (fails nothing by itself):' : '\nnot loaded:');
		for (const line of loading) console.log(`  ${line}`);
	}
	if (!progress) errors.push(...loading);
	if (errors.length > 0) {
		console.log('\nfailures:');
		for (const line of errors) console.log(`  ${line}`);
	}
	return { failed: errors.length > 0, fresh };
}

function rank(suite: string): number {
	const at = order.indexOf(suite);
	return at < 0 ? order.length : at;
}
