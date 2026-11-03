import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface Check {
	cwd: string;
	command: string;
	args: readonly string[];
}

const located = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const unlocated = /^error (TS\d+): (.*)$/;

export function checkerErrors(output: string, cwd: string): Map<string, string[]> {
	const found = new Map<string, string[]>();
	const add = (file: string, problem: string): void => {
		found.set(file, [...(found.get(file) ?? []), problem]);
	};
	for (const line of output.split('\n')) {
		const at = located.exec(line.trim());
		if (at !== null) {
			add(resolve(cwd, at[1] ?? ''), `${at[2]}:${at[3]} ${at[4]} ${at[5]}`);
			continue;
		}
		const global = unlocated.exec(line.trim());
		if (global !== null) add('', `${global[1]} ${global[2]}`);
	}
	return found;
}

export function runCheck(check: Check): Map<string, string[]> {
	const result = spawnSync(check.command, [...check.args], { cwd: check.cwd, encoding: 'utf8' });
	const errors = checkerErrors(result.stdout ?? '', check.cwd);
	if (result.status !== 0 && errors.size === 0)
		errors.set('', [
			`${check.command} ended with ${result.status ?? result.signal}: ${result.stderr ?? ''}`
		]);
	return errors;
}

export function problemsOf(
	errors: ReadonlyMap<string, readonly string[]>,
	file: string,
	checked: readonly string[]
): string[] {
	return [...errors].flatMap(([at, problems]) =>
		at === file
			? problems
			: checked.includes(at)
				? []
				: problems.map((problem) => `${at === '' ? 'program' : at}: ${problem}`)
	);
}
