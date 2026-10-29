import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { compileModule, type CompileOptions } from 'svelte/compiler';
import { afterAll, assert, beforeAll, inject, it } from 'vitest';
import { faults, load, root, ruling, runs } from '../manifest.ts';
import { suiteNamed } from '../suites.ts';
import type { Fresh } from '../target.ts';
import { compileDirectory } from './compile.ts';
import type { Base, Config, Variant } from './config.ts';
import { listen, runVariant, unlisten, type Session } from './run.ts';
import { presence, variants, type Presence } from './variants.ts';

export interface Sample<C extends Base> {
	name: string;
	cwd: string;
	config: C;
}

export interface Kind<C extends Base> {
	root: 'sample' | 'repository';
	variants: readonly Variant[];
	presence(variant: Variant, config: C, name: string): Presence;
	compile(cwd: string, options: CompileOptions): void;
	run(
		sample: Sample<C>,
		variant: Variant,
		options: CompileOptions,
		session: Session
	): Promise<void>;
	concurrent?: boolean;
	close?(): Promise<void>;
}

export function reference(
	rootDir: string,
	own: Partial<CompileOptions> | undefined
): CompileOptions {
	return {
		generate: 'client',
		rootDir,
		experimental: { async: true },
		...own,
		runes: own && 'runes' in own ? own.runes : true
	};
}

export function compileBoth(cwd: string, options: CompileOptions): void {
	compileDirectory(cwd, 'client', options);
	compileDirectory(cwd, 'server', options);
}

async function reactive(work: string): Promise<Session['reactive']> {
	const source = join(root, 'src', 'runtime', 'props.svelte.js');
	const compiled = compileModule(readFileSync(source, 'utf8'), {
		filename: source,
		generate: 'client',
		dev: false
	});
	const out = join(work, 'props.svelte.js');
	mkdirSync(work, { recursive: true });
	writeFileSync(out, compiled.js.code);
	const module = (await import(out)) as { reactive: Session['reactive'] };
	return module.reactive;
}

export async function sampleSuite<C extends Base>(suite: string, kind: Kind<C>): Promise<void> {
	const target = inject('target');
	const samples = join(root, 'samples', 'svelte', suite);
	const run = join(target.root, '.work', `${suite}-${process.pid}`);
	const dir = join(run, 'packages', 'svelte', 'tests', suiteNamed(suite).source);
	const cwdOf = (name: string): string => join(dir, name);

	rmSync(run, { recursive: true, force: true });
	cpSync(samples, dir, { recursive: true });

	const manifest = load('svelte', suite);
	const session: Session = {
		fresh: (await import(target.fresh)) as Fresh,
		reactive: await reactive(run)
	};

	beforeAll(listen);
	afterAll(async () => {
		unlisten();
		await kind.close?.();
		rmSync(run, { recursive: true, force: true });
	});

	const names = readdirSync(dir)
		.filter((name) => !name.startsWith('.'))
		.sort();
	const missing = Object.keys(manifest.samples).filter((name) => !names.includes(name));
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

	for (const name of names) {
		const cwd = cwdOf(name);
		const file = join(cwd, '_config.js');
		const config = (existsSync(file) ? ((await import(file)) as { default: C }).default : {}) as C;
		let setup: Promise<CompileOptions> | undefined;

		for (const variant of kind.variants) {
			const present = kind.presence(variant, config, name);
			if (present === 'absent') continue;
			const title = `${name} (${variant})`;
			const rule = ruling(manifest, name, variant);
			if (rule === undefined) {
				it(title, () => assert.fail(`${suite}/${name}/${variant} has no status in the manifest`));
				continue;
			}
			const skipped = config.skip || present === 'skipped' || !runs(rule.status);
			const test = kind.concurrent ? it.concurrent : it;
			const register = skipped ? test.skip : config.solo ? test.only : test;
			register(title, { timeout: config.timeout }, async () => {
				setup ??= (async () => {
					const options = reference(kind.root === 'sample' ? cwd : run, config.compileOptions);
					if (!config.load_compiled) kind.compile(cwd, options);
					return options;
				})();
				await kind.run({ name, cwd, config }, variant, await setup, session);
			});
		}
	}
}

export const runtime: Kind<Config> = {
	root: 'sample',
	variants,
	presence,
	compile: compileBoth,
	run: runVariant
};

export async function runtimeSuite(suite: string): Promise<void> {
	if (suiteNamed(suite).kind !== 'runtime') throw new Error(`${suite} is not a runtime suite`);
	await sampleSuite(suite, runtime);
}
