import type { StandardSchemaV1 } from '@standard-schema/spec';

export type ParamMatcher<Output = any> = StandardSchemaV1<string, Output>;
export type ParamValue = string | number | boolean | bigint;
export type ParamDefinition =
	| ((value: string) => ParamValue | undefined)
	| StandardSchemaV1<string, ParamValue>;
export type ParamEntry<T> =
	T extends StandardSchemaV1<any, any>
		? StandardSchemaV1.InferOutput<T> extends ParamValue
			? StandardSchemaV1<any, T>
			: StandardSchemaV1<any, never>
		: T extends (value: string) => infer Output
			? StandardSchemaV1<
					any,
					Exclude<Output, undefined> extends ParamValue ? Exclude<Output, undefined> : never
				>
			: never;
export type DefinedParams<T extends Record<string, ParamDefinition>> = {
	readonly [K in keyof T]: ParamEntry<T[K]>;
};
export type MatcherParam<T extends StandardSchemaV1<any, any>> =
	T extends StandardSchemaV1<any, infer Output>
		? Output extends ParamValue
			? Output
			: Output extends StandardSchemaV1<any, any>
				? StandardSchemaV1.InferOutput<Output> extends ParamValue
					? StandardSchemaV1.InferOutput<Output>
					: never
				: never
		: never;
export declare function defineParams<T extends Record<string, ParamDefinition>>(
	definitions: T
): DefinedParams<T>;
