import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, assert, inject, it } from 'vitest';
import { faults, load, root, ruling, runsOn, type Manifest, type Status } from './manifest.ts';
import type { Base } from './runtime/config.ts';
import { reaches, selects } from './scope.ts';
import { suiteId, suiteNamed, upstreamSkip } from './suites.ts';

export interface Sample<C extends Base> {
	name: string;
	cwd: string;
	config: C;
	broken?: unknown;
}

export interface Workspace<C extends Base> {
	id: string;
	run: string;
	manifest: Manifest;
	samples: Sample<C>[];
	running(status: Status): boolean;
}

export async function workspace<C extends Base>(suite: string): Promise<Workspace<C>> {
	const target = inject('target');
	const named = suiteNamed(suite);
	const { project, source, tests = [] } = named;
	const id = suiteId(named);
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
		if (!reaches(id, name)) continue;
		const cwd = join(dir, name);
		const file = join(cwd, '_config.js');
		if (!existsSync(file)) {
			samples.push({ name, cwd, config: {} as C });
			continue;
		}
		try {
			const config = ((await import(file)) as { default: C }).default;
			samples.push({ name, cwd, config });
		} catch (error) {
			samples.push({ name, cwd, config: {} as C, broken: error });
		}
	}
	return {
		id,
		run,
		manifest,
		samples,
		running: (status) => runsOn(status, project, target.name)
	};
}

export interface Inline {
	skip?: boolean;
	run(): void | Promise<void>;
}

export interface Plain<C extends Base> {
	run(sample: Sample<C>, run: string): void | Promise<void>;
	tests?: Readonly<Record<string, Inline>>;
}

export function register(
	{ id, manifest, running }: Workspace<Base>,
	title: string,
	config: Base,
	body: () => void | Promise<void>
): void {
	if (!selects(id, title)) return;
	const rule = ruling(manifest, title);
	if (rule === undefined) {
		it(title, () => assert.fail(`${id}/${title} has no status in the manifest`));
		return;
	}
	const runs = running(rule.status);
	const test = !runs || config.skip ? it.skip : config.solo ? it.only : it;
	test(title, runs && config.skip ? { meta: upstreamSkip } : { timeout: config.timeout }, body);
}

export function unloadable(sample: Sample<Base>): () => never {
	return () => {
		throw sample.broken;
	};
}

export async function plainSuite<C extends Base>(suite: string, kind: Plain<C>): Promise<void> {
	const space = await workspace<C>(suite);
	for (const sample of space.samples) {
		register(
			space,
			sample.name,
			sample.config,
			sample.broken === undefined ? () => kind.run(sample, space.run) : unloadable(sample)
		);
	}
	for (const title of suiteNamed(suite).tests ?? []) {
		if (!selects(space.id, title)) continue;
		const inline = kind.tests?.[title];
		if (inline === undefined) {
			it(title, () => assert.fail(`${suite} has no implementation of "${title}"`));
			continue;
		}
		register(space, title, { skip: inline.skip }, inline.run);
	}
}
