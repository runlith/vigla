import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface EnvVarConfig<T> {
	public?: boolean;
	static?: boolean;
	schema?: StandardSchemaV1<string | undefined, T> | ((value: string | undefined) => T | undefined);
	description?: string;
}
export type EnvVarEntry<Config extends EnvVarConfig<any>> =
	Config['schema'] extends StandardSchemaV1<any, any>
		? Config
		: Config['schema'] extends (value: any) => infer Result
			? Omit<Config, 'schema'> & { schema: StandardSchemaV1<string | undefined, Result> }
			: Config;
export type DefinedEnvVars<T extends Record<string, EnvVarConfig<any>>> = {
	readonly [K in keyof T]: EnvVarEntry<T[K]>;
};
export declare function defineEnvVars<T extends Record<string, EnvVarConfig<any>>>(
	variables: T
): DefinedEnvVars<T>;
