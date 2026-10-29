import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { compile, compileModule } from 'svelte/compiler';
import { afterAll, assert, describe, inject, it } from 'vitest';
import { faults, load, root, ruling, runs, type Manifest } from '../manifest.ts';
import { forced } from '../reference.ts';
import { suiteNamed, unitFile, type Suite } from '../suites.ts';
import { govern, it as rule, registered } from './vitest.ts';

function unitFiles(suite: Suite, dir: string): string[] {
	if (suite.include === undefined) return [unitFile(suite)];
	const include = suite.include;
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(dir, join(entry.parentPath, entry.name)))
		.filter((file) => include.test(file))
		.sort();
}

async function runes(source: string, out: string): Promise<string> {
	const compiled = compileModule(stripTypeScriptTypes(readFileSync(source, 'utf8')), {
		filename: source,
		generate: 'client',
		dev: true,
		experimental: { async: true }
	});
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, compiled.js.code);
	return out;
}

async function collect(
	suite: string,
	manifest: Manifest,
	dir: string,
	work: string,
	file: string,
	prefix: readonly string[]
): Promise<void> {
	govern(suite, manifest, prefix);
	const lead = prefix.length === 0 ? '' : `${prefix.join(' > ')} > `;
	const own = Object.keys(manifest.samples).filter((key) => key.startsWith(lead));
	const loaded = registered.length;
	try {
		if (file in (manifest.conversions ?? {})) {
			await import(await runes(join(dir, file), join(work, `${file}.js`)));
			return;
		}
		if (own.some((key) => runs(ruling(manifest, key)?.status ?? 'contract'))) {
			await import(join(dir, file));
			return;
		}
	} catch (error) {
		if (registered.length > loaded) throw error;
		for (const key of own)
			rule(key.slice(lead.length), () => {
				throw error;
			});
		return;
	}
	for (const key of own) rule(key.slice(lead.length), () => {});
}

async function reference(work: string): Promise<void> {
	const file = join(work, 'reference.svelte');
	const compiled = compile('', { filename: file, generate: 'client', ...forced(undefined) });
	mkdirSync(work, { recursive: true });
	writeFileSync(`${file}.js`, compiled.js.code);
	await import(`${file}.js`);
}

export async function unitSuite(suite: string): Promise<void> {
	const target = inject('target');
	await import(target.fresh);
	const named = suiteNamed(suite);
	const manifest = load('svelte', suite);
	const dir = join(root, 'samples', 'svelte', suite);
	const work = join(target.root, '.work', `units-${suite}-${process.pid}`);
	afterAll(() => rmSync(work, { recursive: true, force: true }));
	if (Object.keys(manifest.conversions ?? {}).length > 0) await reference(work);
	for (const file of unitFiles(named, dir)) {
		if (named.include === undefined) await collect(suite, manifest, dir, work, file, []);
		else describe(file, () => collect(suite, manifest, dir, work, file, [file]));
	}
	it('manifest', () => {
		const missing = Object.keys(manifest.samples).filter((name) => !registered.includes(name));
		assert.deepEqual(
			{ missing, broken: faults(manifest) },
			{ missing: [], broken: [] },
			'manifest entries without a test, or faulty'
		);
	});
}
