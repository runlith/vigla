import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { withDependents } from './order.ts';
import { test, type Package } from './pack.ts';

export type Step = 'patch' | 'minor';

function git(root: string, args: string[]): string {
	const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
	return result.stdout.trim();
}

export function lastRelease(root: string): string {
	const result = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'release/*'], {
		cwd: root,
		encoding: 'utf8'
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(
			'No release/* tag is reachable from HEAD: tag the commit the registry was last published from, or pass --since <commit>'
		);
	return result.stdout.trim();
}

export function changedSince(root: string, base: string): string[] {
	const tracked = git(root, ['diff', '--name-only', base, '--']);
	const added = git(root, ['ls-files', '--others', '--exclude-standard']);
	return [tracked, added].flatMap((list) => (list === '' ? [] : list.split('\n')));
}

export function changed(packages: Package[], root: string, paths: string[]): Set<string> {
	const names = new Set<string>();
	for (const item of packages) {
		const prefix = path.relative(root, item.directory).split(path.sep).join('/') + '/';
		const published = ['package.json', ...(item.manifest.files ?? [])];
		const hit = paths.some((file) => {
			if (!file.startsWith(prefix) || test.test(file)) return false;
			const inside = file.slice(prefix.length);
			return published.some((entry) => inside === entry || inside.startsWith(entry + '/'));
		});
		if (hit) names.add(item.manifest.name);
	}
	return names;
}

export function next(version: string, step: Step): string {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	if (!match) throw new Error(`${version} is not a major.minor.patch version`);
	const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
	return step === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

export function plan(
	packages: Package[],
	changed: ReadonlySet<string>,
	minor: ReadonlySet<string>
): Map<string, string> {
	for (const name of minor)
		if (!packages.some((item) => item.manifest.name === name))
			throw new Error(`No publishable workspace package named ${name}`);
	const raised = withDependents(packages, [...changed, ...minor]);
	return new Map(
		packages
			.filter((item) => raised.has(item.manifest.name))
			.map((item) => [
				item.manifest.name,
				next(item.manifest.version, minor.has(item.manifest.name) ? 'minor' : 'patch')
			])
	);
}

function replace(file: string, from: string, to: string): void {
	const parts = readFileSync(file, 'utf8').split(from);
	if (parts.length !== 2)
		throw new Error(`${file} holds ${from} ${parts.length - 1} times, expected once`);
	writeFileSync(file, parts.join(to));
}

export function write(item: Package, version: string): void {
	const from = item.manifest.version;
	replace(
		path.join(item.directory, 'package.json'),
		`"version": "${from}"`,
		`"version": "${version}"`
	);
	const literal = item.manifest.release?.version;
	if (literal)
		replace(path.join(item.directory, literal), `VERSION = '${from}'`, `VERSION = '${version}'`);
}
