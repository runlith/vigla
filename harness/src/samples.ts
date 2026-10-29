import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, assert, inject, it } from 'vitest';
import { faults, load, root, ruling, runs, type Manifest } from './manifest.ts';
import type { Base } from './runtime/config.ts';
import { suiteNamed } from './suites.ts';

export interface Sample<C extends Base> {
	name: string;
	cwd: string;
	config: C;
}

export interface Workspace<C extends Base> {
	run: string;
	manifest: Manifest;
	samples: Sample<C>[];
}

export async function workspace<C extends Base>(suite: string): Promise<Workspace<C>> {
	const target = inject('target');
	const { project, source, tests = [] } = suiteNamed(suite);
	const run = join(target.root, '.work', `${suite}-${process.pid}`);
	const dir = join(run, 'packages', 'svelte', 'tests', source);

	rmSync(run, { recursive: true, force: true });
	cpSync(join(root, 'samples', project, suite), dir, { recursive: true });
	afterAll(() => rmSync(run, { recursive: true, force: true }));

	const manifest = load(project, suite);
	const names = readdirSync(dir)
		.filter((name) => !name.startsWith('.'))
		.sort();
	const missing = Object.keys(manifest.samples).filter(
		(name) => !names.includes(name) && !tests.includes(name)
	);
	const broken = faults(manifest);
	if (missing.length > 0 || broken.length > 0) {
		it('manifest', () => {
			assert.deepEqual(
				{ missing, broken },
				{ missing: [], broken: [] },
				'manifest entries without a sample, or faulty'
			);
		});
	}

	const samples: Sample<C>[] = [];
	for (const name of names) {
		const cwd = join(dir, name);
		const file = join(cwd, '_config.js');
		const config = (existsSync(file) ? ((await import(file)) as { default: C }).default : {}) as C;
		samples.push({ name, cwd, config });
	}
	return { run, manifest, samples };
}

export interface Inline {
	skip?: boolean;
	run(): void | Promise<void>;
}

export interface Plain<C extends Base> {
	run(sample: Sample<C>, run: string): void | Promise<void>;
	tests?: Readonly<Record<string, Inline>>;
}

function register(
	suite: string,
	manifest: Manifest,
	title: string,
	config: Base,
	body: () => void | Promise<void>
): void {
	const rule = ruling(manifest, title);
	if (rule === undefined) {
		it(title, () => assert.fail(`${suite}/${title} has no status in the manifest`));
		return;
	}
	const skipped = config.skip || !runs(rule.status);
	const test = skipped ? it.skip : config.solo ? it.only : it;
	test(title, { timeout: config.timeout }, body);
}

export async function plainSuite<C extends Base>(suite: string, kind: Plain<C>): Promise<void> {
	const { run, manifest, samples } = await workspace<C>(suite);
	for (const sample of samples) {
		register(suite, manifest, sample.name, sample.config, () => kind.run(sample, run));
	}
	for (const title of suiteNamed(suite).tests ?? []) {
		const inline = kind.tests?.[title];
		if (inline === undefined) {
			it(title, () => assert.fail(`${suite} has no implementation of "${title}"`));
			continue;
		}
		register(suite, manifest, title, { skip: inline.skip }, inline.run);
	}
}
