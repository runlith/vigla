import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { problemsOf, runCheck } from '../checker.ts';

interface Module {
	name: string;
	assertionResults: {
		ancestorTitles: string[];
		title: string;
		status: string;
		failureMessages: string[];
	}[];
}

const [copy, out] = process.argv.slice(2);
if (copy === undefined || out === undefined) {
	console.error('usage: reference.ts <svelte copy> <upstream report.json>');
	process.exit(2);
}
const svelte = join(resolve(copy), 'packages', 'svelte');
const dir = join(svelte, 'tests', 'types');
const report = resolve(out);

const files = readdirSync(dir)
	.filter((name) => name.endsWith('.ts'))
	.sort()
	.map((name) => join(dir, name));
const errors = runCheck({
	cwd: dir,
	command: 'node',
	args: [join(svelte, 'node_modules', 'typescript', 'bin', 'tsc'), '--pretty', 'false']
});
const module: Module = {
	name: dir,
	assertionResults: files.map((file) => {
		const problems = problemsOf(errors, file, files);
		return {
			ancestorTitles: [],
			title: file.slice(dir.length + 1),
			status: problems.length === 0 ? 'passed' : 'failed',
			failureMessages: problems
		};
	})
};
const results = existsSync(report)
	? (JSON.parse(readFileSync(report, 'utf8')) as { testResults: Module[] })
	: { testResults: [] };
results.testResults = [...results.testResults.filter((other) => other.name !== dir), module];
writeFileSync(report, JSON.stringify(results));
for (const result of module.assertionResults) console.log(`${result.status} ${result.title}`);
