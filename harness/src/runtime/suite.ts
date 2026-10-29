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
import type { Fresh } from '../target.ts';
import { compileDirectory } from './compile.ts';
import type { Config } from './config.ts';
import { listen, runVariant, unlisten, type Session } from './run.ts';
import { presence, variants } from './variants.ts';

function options(cwd: string, config: Config): CompileOptions {
	const own = config.compileOptions;
	return {
		generate: 'client',
		rootDir: cwd,
		experimental: { async: true },
		...own,
		runes: own && 'runes' in own ? own.runes : true
	};
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

export async function runtimeSuite(suite: string): Promise<void> {
	const target = inject('target');
	const samples = join(root, 'samples', 'svelte', suite);
	const run = join(target.root, '.work', `${suite}-${process.pid}`);
	const work = join(run, 'svelte');
	const cwdOf = (name: string): string => join(work, suite, name);

	rmSync(run, { recursive: true, force: true });
	cpSync(samples, join(work, suite), { recursive: true });

	const manifest = load('svelte', suite);
	const session: Session = {
		fresh: (await import(target.fresh)) as Fresh,
		reactive: await reactive(work)
	};

	beforeAll(listen);
	afterAll(() => {
		unlisten();
		rmSync(run, { recursive: true, force: true });
	});

	const names = readdirSync(join(work, suite))
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
		const config = (
			existsSync(file) ? ((await import(file)) as { default: Config }).default : {}
		) as Config;
		let setup: Promise<CompileOptions> | undefined;

		for (const variant of variants) {
			const present = presence(variant, config, name);
			if (present === 'absent') continue;
			const title = `${name} (${variant})`;
			const rule = ruling(manifest, name, variant);
			if (rule === undefined) {
				it(title, () => assert.fail(`${suite}/${name}/${variant} has no status in the manifest`));
				continue;
			}
			const skipped = config.skip || present === 'skipped' || !runs(rule.status);
			const register = skipped ? it.skip : config.solo ? it.only : it;
			register(title, { timeout: config.timeout }, async () => {
				setup ??= (async () => {
					const compileOptions = options(cwd, config);
					if (!config.load_compiled) {
						compileDirectory(cwd, 'client', compileOptions);
						compileDirectory(cwd, 'server', compileOptions);
					}
					return compileOptions;
				})();
				await runVariant({ name, cwd, config }, variant, await setup, session);
			});
		}
	}
}
