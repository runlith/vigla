import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, inject } from 'vitest';
import { problemsOf, runCheck } from '../checker.ts';
import { root, ruling } from '../manifest.ts';
import type { Base } from '../runtime/config.ts';
import { register, workspace } from '../samples.ts';
import { selects } from '../scope.ts';

const compilerOptions = {
	module: 'esnext',
	lib: ['esnext', 'dom', 'dom.iterable'],
	target: 'esnext',
	noEmit: true,
	moduleResolution: 'bundler',
	resolveJsonModule: true,
	noErrorTruncation: true,
	allowSyntheticDefaultImports: true,
	verbatimModuleSyntax: true,
	types: ['node'],
	strict: true,
	allowJs: true,
	checkJs: true
};

export async function typesSuite(): Promise<void> {
	const space = await workspace<Base>('types');
	const target = inject('target');
	const files = space.samples
		.filter((sample) => {
			const rule = ruling(space.manifest, sample.name);
			return (
				sample.name.endsWith('.ts') &&
				rule !== undefined &&
				space.running(rule.status) &&
				selects(space.id, sample.name)
			);
		})
		.map((sample) => sample.cwd);
	let errors: Map<string, string[]> | undefined;
	const check = (dir: string): Map<string, string[]> => {
		if (errors !== undefined) return errors;
		const declarations = realpathSync(
			join(target.root, 'node_modules', 'svelte', 'types', 'index.d.ts')
		);
		writeFileSync(
			join(dir, 'tsconfig.harness.json'),
			JSON.stringify({ compilerOptions, files: [declarations, ...files] })
		);
		errors = runCheck({
			cwd: dir,
			command: join(root, '..', 'node_modules', '.bin', 'tsrs'),
			args: ['--pretty', 'false', '-p', 'tsconfig.harness.json']
		});
		return errors;
	};
	for (const sample of space.samples) {
		register(space, sample.name, { skip: sample.name.endsWith('.svelte') }, () => {
			assert.deepEqual(problemsOf(check(join(sample.cwd, '..')), sample.cwd, files), []);
		});
	}
}
