import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileModule, type CompileOptions } from 'svelte/compiler';
import { afterAll, assert, beforeAll, inject, it } from 'vitest';
import { root, ruling, runs } from '../manifest.ts';
import { forced } from '../reference.ts';
import { workspace, type Sample } from '../samples.ts';
import { suiteNamed } from '../suites.ts';
import type { Fresh } from '../target.ts';
import { compileDirectory } from './compile.ts';
import type { Base, Config, Variant } from './config.ts';
import { listen, runVariant, unlisten, type Session } from './run.ts';
import { presence, variants, type Presence } from './variants.ts';

export type { Sample };

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
	return { generate: 'client', rootDir, ...forced(own) };
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
	const { run, manifest, samples } = await workspace<C>(suite);
	const session: Session = {
		fresh: (await import(target.fresh)) as Fresh,
		reactive: await reactive(run)
	};

	beforeAll(listen);
	afterAll(async () => {
		unlisten();
		await kind.close?.();
	});

	for (const { name, cwd, config } of samples) {
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
