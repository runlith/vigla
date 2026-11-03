import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkerErrors, type Check } from '../checker.ts';

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
		for (const [file, problems] of checkerErrors(result.stdout ?? '', check.cwd))
			failing.set(file, [...(failing.get(file) ?? []), ...problems]);
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
