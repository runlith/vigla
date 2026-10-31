import { describe, expect, it } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { ASYNC_VALIDATOR, BAD_VALIDATOR, MISSING, handleIssues, validate } from './env.ts';
import type { EnvironmentIssues } from './env.ts';

const numeric: StandardSchemaV1<string | undefined, number> = {
	'~standard': {
		version: 1,
		vendor: 'contract',
		validate: (value) =>
			typeof value === 'string' && /^\d+$/.test(value)
				? { value: Number(value) }
				: { issues: [{ message: 'expected digits', path: ['PORT'] }] }
	}
};

describe('environment validation', () => {
	it('preserves empty values, transforms configured values and forwards issues', () => {
		const issues: EnvironmentIssues = {};
		expect(validate({}, '', 'EMPTY', issues)).toBe('');
		expect(validate({ PORT: { schema: numeric } }, '3000', 'PORT', issues)).toBe(3000);
		validate({ PORT: { schema: numeric } }, 'bad', 'PORT', issues);
		expect(issues.PORT).toEqual([{ message: 'expected digits', path: ['PORT'] }]);
	});

	it('reports missing, malformed and asynchronous schemas in one failure', () => {
		const issues: EnvironmentIssues = {};
		validate({}, undefined, 'ABSENT', issues);
		validate(
			{ BAD: { schema: {} as StandardSchemaV1<string | undefined, unknown> } },
			'value',
			'BAD',
			issues
		);
		validate(
			{
				ASYNC: {
					schema: {
						'~standard': { version: 1, vendor: 'contract', validate: async (value) => ({ value }) }
					}
				}
			},
			'value',
			'ASYNC',
			issues
		);
		expect(issues).toEqual({ ABSENT: [MISSING], BAD: [BAD_VALIDATOR], ASYNC: [ASYNC_VALIDATOR] });
		expect(() => handleIssues(issues)).toThrow(/env_invalid/);
	});
});
