import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Kind = 'playwright' | 'vitest' | 'shell';

export interface Step {
	label: string | null;
	kind: Kind;
	env: Record<string, string>;
	command: string;
	args: string[];
}

const assignment = /^([A-Z_][A-Z0-9_]*)=(.*)$/;

function tokens(segment: string): string[] {
	return segment.trim().split(/\s+/).filter(Boolean);
}

function expand(
	scripts: Record<string, string>,
	name: string,
	env: Record<string, string>,
	into: Step[]
): void {
	const script = scripts[name];
	if (script === undefined) throw new Error(`no script ${name}`);
	for (const segment of script.split('&&')) {
		const words = tokens(segment);
		const own = { ...env };
		while (words.length > 0) {
			const match = assignment.exec(words[0] ?? '');
			if (match === null) break;
			own[match[1] ?? ''] = (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
			words.shift();
		}
		const [head = '', second = '', ...rest] = words;
		const called = head === 'pnpm' ? (second === 'run' ? rest[0] : second) : undefined;
		const extra = head === 'pnpm' ? (second === 'run' ? rest.slice(1) : rest) : [];
		if (called !== undefined && scripts[called] !== undefined && extra.length === 0) {
			expand(scripts, called, own, into);
		} else if (head === 'playwright' && second === 'test') {
			into.push({
				label: null,
				kind: 'playwright',
				env: own,
				command: 'playwright',
				args: ['test', ...rest]
			});
		} else if (head === 'vitest' && second === 'run') {
			into.push({
				label: null,
				kind: 'vitest',
				env: own,
				command: 'vitest',
				args: ['run', ...rest]
			});
		} else {
			const command = segment.trim().replace(/^(?:[A-Z_][A-Z0-9_]*=\S*\s+)*/, '');
			into.push({ label: null, kind: 'shell', env: own, command, args: [] });
		}
	}
}

export function labelOf(name: string): string {
	return name.replace(/[:= ]/g, '-').toLowerCase();
}

export function plan(dir: string, names: readonly string[]): Step[] {
	const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
		scripts?: Record<string, string>;
	};
	const scripts = manifest.scripts ?? {};
	const steps: Step[] = [];
	for (const name of names) {
		const words = tokens(name);
		const env: Record<string, string> = {};
		for (let match = assignment.exec(words[0] ?? ''); match !== null;) {
			env[match[1] ?? ''] = match[2] ?? '';
			words.shift();
			match = assignment.exec(words[0] ?? '');
		}
		const script = words.join(' ');
		if (scripts[script] === undefined) continue;
		const expanded: Step[] = [];
		expand(scripts, script, env, expanded);
		let count = 0;
		for (const step of expanded) {
			if (step.kind !== 'shell') step.label = `${labelOf(name)}-${++count}`;
			steps.push(step);
		}
	}
	return steps;
}

export interface Execution {
	cwd: string;
	path: readonly string[];
	env: Record<string, string>;
	report(label: string): string;
}

export function execute(step: Step, execution: Execution): number {
	const env: Record<string, string | undefined> = {
		...process.env,
		...execution.env,
		...step.env,
		PATH: [...execution.path, process.env.PATH].join(':')
	};
	let command = step.command;
	let args = step.args;
	if (step.kind === 'shell') {
		args = ['-c', step.command];
		command = 'sh';
	} else if (step.label !== null) {
		const report = execution.report(step.label);
		if (step.kind === 'playwright') {
			args = [...args, '--reporter=dot,json'];
			env.PLAYWRIGHT_JSON_OUTPUT_NAME = report;
		} else args = [...args, '--reporter=dot', '--reporter=json', `--outputFile.json=${report}`];
	}
	const result = spawnSync(command, args, { cwd: execution.cwd, env, stdio: 'inherit' });
	return result.status ?? 1;
}
