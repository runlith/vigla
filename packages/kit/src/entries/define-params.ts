import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Identity } from '../types/identity.ts';
import type { DefinedParams, ParamDefinition, ParamMatcher } from '../types/params.ts';
import { diagnostics } from '../shared/diagnostics.ts';
import { param_definition_invalid } from '../shared/errors.ts';

export type DefineParams = <T extends Record<string, ParamDefinition>>(
	definitions: T
) => DefinedParams<T>;

export function paramsDefiner(identity: Identity): DefineParams {
	const d = diagnostics(identity);
	const matcher = (definition: ParamDefinition): ParamMatcher => {
		if (
			definition &&
			(typeof definition === 'object' || typeof definition === 'function') &&
			'~standard' in definition
		)
			return definition;
		if (typeof definition !== 'function') param_definition_invalid(d);
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
	};
	return <T extends Record<string, ParamDefinition>>(definitions: T) =>
		Object.fromEntries(
			Object.entries(definitions).map(([name, definition]) => [name, matcher(definition)])
		) as DefinedParams<T>;
}
