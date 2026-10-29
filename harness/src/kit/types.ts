import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface Check {
	cwd: string;
	command: string;
	args: readonly string[];
}

function tests(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...tests(path));
		else if (entry.name.endsWith('.test.ts')) found.push(path);
	}
	return found.sort();
}

export function checkTypes(dir: string, checks: readonly Check[], report: string): void {
	const failing = new Map<string, string[]>();
	for (const check of checks) {
		const result = spawnSync(check.command, [...check.args], { cwd: check.cwd, encoding: 'utf8' });
		process.stdout.write(result.stdout ?? '');
		process.stderr.write(result.stderr ?? '');
		for (const line of `${result.stdout ?? ''}`.split('\n')) {
			const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line.trim());
			if (match === null) continue;
			const file = resolve(check.cwd, match[1] ?? '');
			failing.set(file, [
				...(failing.get(file) ?? []),
				`${match[2]}:${match[3]} ${match[4]} ${match[5]}`
			]);
		}
	}
	const testResults = tests(dir).map((name) => {
		const problems = failing.get(name);
		return {
			name,
			status: problems === undefined ? 'passed' : 'failed',
			assertionResults: [
				{
					ancestorTitles: [],
					title: 'typechecks',
					status: problems === undefined ? 'passed' : 'failed',
					failureMessages: problems ?? []
				}
			]
		};
	});
	writeFileSync(report, JSON.stringify({ testResults }, null, 1));
}
