import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { EnvVarConfig } from '../types/env.ts';
import { runtime, type Diagnostics } from './diagnostics.ts';

export type EnvironmentIssues = Record<string, StandardSchemaV1.Issue[]>;
export type EnvironmentVariables = Record<string, EnvVarConfig<any> | undefined>;

export const MISSING: StandardSchemaV1.Issue = {
	message: 'Value is missing. If it is optional, add a validator declaring it as such.'
};
export const BAD_VALIDATOR: StandardSchemaV1.Issue = {
	message: 'Variable was configured with a validator that does not implement Standard Schema'
};
export const ASYNC_VALIDATOR: StandardSchemaV1.Issue = {
	message: 'Variable uses an async validator, which is not supported'
};

export function validate(
	variables: EnvironmentVariables,
	value: string | undefined,
	name: string,
	issues: EnvironmentIssues
): any {
	const schema = variables[name]?.schema;
	if (!schema) {
		if (value === undefined) issues[name] = [MISSING];
		return value;
	}
	if (!('~standard' in schema)) {
		issues[name] = [BAD_VALIDATOR];
		return undefined;
	}
	const result = schema['~standard'].validate(value);
	if (result instanceof Promise) {
		result.catch(() => {});
		issues[name] = [ASYNC_VALIDATOR];
		return undefined;
	}
	if (result.issues) {
		issues[name] = [...result.issues];
		return undefined;
	}
	return result.value;
}

export function handleIssues(issues: EnvironmentIssues, d: Diagnostics = runtime): void {
	const entries = Object.entries(issues);
	if (!entries.length) return;
	const list = entries
		.map(([name, found]) => `${name}\n${found.map((issue) => `  - ${issue.message}`).join('\n')}`)
		.join('\n\n');
	try {
		d.raise('env_invalid', `Invalid environment variables:\n\n${list}\n`, handleIssues);
	} catch (error) {
		if (error instanceof Error) error.stack = `${error.name}: ${error.message}`;
		throw error;
	}
}
