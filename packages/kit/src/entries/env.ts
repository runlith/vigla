import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DefinedEnvVars, EnvVarConfig } from '../types/env.ts';

export type { DefinedEnvVars, EnvVarConfig } from '../types/env.ts';

type Validator = (value: string | undefined) => any;

function schema(validate: Validator): StandardSchemaV1<string | undefined, any> {
	return {
		'~standard': {
			version: 1,
			vendor: 'vigla',
			validate(value) {
				try {
					const output = validate(value as string | undefined);
					return output instanceof Promise ? output : { value: output };
				} catch (error) {
					return {
						issues: [
							{ message: error instanceof Error ? error.message || 'Invalid value' : String(error) }
						]
					};
				}
			}
		}
	};
}

export function defineEnvVars<T extends Record<string, EnvVarConfig<any>>>(
	variables: T
): DefinedEnvVars<T> {
	const entries = Object.entries(variables).map(([name, config]) => [
		name,
		typeof config.schema === 'function' && !('~standard' in config.schema)
			? { ...config, schema: schema(config.schema) }
			: config
	]);
	return Object.fromEntries(entries) as DefinedEnvVars<T>;
}
