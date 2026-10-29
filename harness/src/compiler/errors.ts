import { existsSync } from 'node:fs';
import { compile, compileModule, type CompileError } from 'svelte/compiler';
import { assert, expect } from 'vitest';
import type { Base } from '../runtime/config.ts';
import type { Plain, Sample } from '../samples.ts';
import { readText, stripLink } from './diagnostics.ts';

interface ErrorsConfig extends Base {
	error: { code: string; message: string; position?: [number, number] };
}

function expectError(config: ErrorsConfig, run: () => void): void {
	let caught = false;
	try {
		run();
	} catch (thrown) {
		const error = thrown as CompileError;
		caught = true;
		expect(error.code).toBe(config.error.code);
		expect(stripLink(error.message)).toBe(config.error.message);
		if (config.error.position) expect(error.position).toEqual(config.error.position);
	}
	if (!caught) assert.fail('Expected an error');
}

function reject({ cwd, config }: Sample<ErrorsConfig>): void {
	const component = `${cwd}/main.svelte`;
	const module = `${cwd}/main.svelte.js`;
	if (!existsSync(component) && !existsSync(module)) {
		throw new Error('Expected main.svelte or main.svelte.js');
	}
	if (existsSync(component)) {
		expectError(config, () =>
			compile(readText(component), {
				generate: 'client',
				experimental: { async: true },
				runes: true
			})
		);
	}
	if (existsSync(module)) {
		expectError(config, () =>
			compileModule(readText(module), { generate: 'client', experimental: { async: true } })
		);
	}
}

export const compilerErrors: Plain<ErrorsConfig> = {
	run: reject,
	tests: {
		'resets the compiler state including filename': {
			run: () => {
				compile('<div>hello</div>', { filename: 'foo.svelte' });
				try {
					compile('<p>hello<div>invalid</p>', { filename: 'bar.svelte' });
					expect.fail('Expected an error');
				} catch (error) {
					expect(String(error)).toContain('bar.svelte');
				}
			}
		}
	}
};
