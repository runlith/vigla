import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DefinedParams, ParamDefinition, ParamMatcher } from '../types/params.ts';
import { param_definition_invalid } from '../shared/errors.ts';

export type {
	DefinedParams,
	MatcherParam,
	ParamDefinition,
	ParamMatcher,
	ParamValue
} from '../types/params.ts';

function matcher(definition: ParamDefinition): ParamMatcher {
	if (
		definition &&
		(typeof definition === 'object' || typeof definition === 'function') &&
		'~standard' in definition
	)
		return definition;
	if (typeof definition !== 'function') param_definition_invalid();
	const schema: StandardSchemaV1<string, any> = {
		'~standard': {
			version: 1,
			vendor: 'vigla',
			validate(value) {
				const output = definition(value as string);
				if (output === undefined) return { issues: [{ message: 'Invalid param' }] };
				if ((output as unknown) instanceof Promise)
					return output as unknown as Promise<StandardSchemaV1.Result<any>>;
				return { value: output };
			}
		}
	};
	return schema;
}

export function defineParams<T extends Record<string, ParamDefinition>>(
	definitions: T
): DefinedParams<T> {
	return Object.fromEntries(
		Object.entries(definitions).map(([name, definition]) => [name, matcher(definition)])
	) as DefinedParams<T>;
}
