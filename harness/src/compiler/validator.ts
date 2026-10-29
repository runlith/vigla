import { existsSync, readFileSync } from 'node:fs';
import { compile, compileModule, type CompileError, type CompileOptions } from 'svelte/compiler';
import { assert } from 'vitest';
import type { Base } from '../runtime/config.ts';
import type { Plain, Sample } from '../samples.ts';
import { readJson, stripLink, type Diagnostic } from './diagnostics.ts';

type ValidatorConfig = Base;

function located(diagnostic: Diagnostic): Diagnostic {
	return {
		code: diagnostic.code,
		message: stripLink(diagnostic.message),
		start: { line: diagnostic.start?.line, column: diagnostic.start?.column },
		end: { line: diagnostic.end?.line, column: diagnostic.end?.column }
	};
}

function validate({ cwd, config }: Sample<ValidatorConfig>): void {
	const expectedWarnings = readJson<Diagnostic[]>(`${cwd}/warnings.json`) ?? [];
	const expectedErrors = readJson<Diagnostic[]>(`${cwd}/errors.json`);
	const options = readJson<Partial<CompileOptions>>(`${cwd}/options.json`);
	const own = { ...config.compileOptions, ...options };
	let error: CompileError | undefined;

	try {
		const module = existsSync(`${cwd}/input.svelte.js`);
		const input = readFileSync(`${cwd}/${module ? 'input.svelte.js' : 'input.svelte'}`, 'utf8')
			.replace(/\s+$/, '')
			.replace(/\r/g, '');
		const { warnings } = module
			? compileModule(input, { experimental: { async: true }, ...own, generate: false })
			: compile(input, {
					experimental: { async: true },
					...config.compileOptions,
					generate: false,
					...options,
					runes: 'runes' in own ? own.runes : true
				});
		assert.deepEqual(warnings.map(located), expectedWarnings);
	} catch (caught) {
		error = caught as CompileError;
	}

	const expected = expectedErrors?.[0];
	if (error && expected) {
		assert.deepEqual(located(error), {
			code: expected.code,
			message: expected.message,
			start: expected.start,
			end: expected.end
		});
	} else if (expected) {
		throw new Error(`Expected an error: ${expected.message}`);
	} else if (error) {
		throw error;
	}
}

export const validator: Plain<ValidatorConfig> = {
	run: validate,
	tests: {
		'errors if options.name is illegal': {
			skip: true,
			run: () => {
				assert.throws(() => {
					compile('<div></div>', { name: 'not.valid', generate: false });
				}, /options\.name must be a valid identifier/);
			}
		},
		'check warning position': {
			skip: true,
			run: () => {
				const { warnings } = compile('\n  <img \n src="foo.jpg">\n', { generate: false });
				assert.deepEqual(warnings, [
					{
						code: 'a11y-missing-attribute',
						message: 'A11y: `<img>` element should have an alt attribute',
						start: { column: 2, line: 2, character: 3 },
						end: { column: 15, line: 3, character: 24 }
					}
				]);
			}
		},
		'warns if options.name is not capitalised': {
			skip: true,
			run: () => {
				const { warnings } = compile('<div></div>', { name: 'lowercase', generate: false });
				assert.deepEqual(
					warnings.map((warning) => ({ code: warning.code, message: warning.message })),
					[{ code: 'options-lowercase-name', message: 'options.name should be capitalised' }]
				);
			}
		},
		'does not warn if options.name begins with non-alphabetic character': {
			run: () => {
				const { warnings } = compile('<div></div>', { name: '_', generate: false });
				assert.deepEqual(warnings, []);
			}
		},
		'errors if namespace is provided but unrecognised': {
			run: () => {
				assert.throws(() => {
					compile('<div></div>', {
						name: 'test',
						namespace: 'svefefe' as CompileOptions['namespace']
					});
				}, /namespace should be one of "html", "mathml" or "svg"/);
			}
		}
	}
};
