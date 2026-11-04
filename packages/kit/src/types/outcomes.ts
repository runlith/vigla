import type { StandardSchemaV1 } from '@standard-schema/spec';

export interface ErrorBody {
	status: number;
	message: string;
}

export type ErrorProperties = Omit<App.Error, keyof ErrorBody>;
export type ErrorOverrides = ErrorProperties & Partial<ErrorBody>;
export type ErrorReturn = ErrorOverrides | (ErrorBody extends App.Error ? void : never);

export interface ErrorFunction {
	(status: ErrorBody extends App.Error ? number : never, message?: string): never;
	(
		status: number,
		message: string,
		properties: keyof ErrorProperties extends never ? never : ErrorProperties
	): never;
}

export interface HttpError {
	status: number;
	body: App.Error;
}

export type RedirectStatus = 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308;
export interface Redirect {
	status: RedirectStatus;
	location: string;
}
export interface RedirectOptions {
	external?: boolean | string[];
}

declare const failure: unique symbol;
export interface ActionFailure<T = undefined> {
	status: number;
	data: T;
	[failure]: true;
}

export interface ValidationError {
	issues: StandardSchemaV1.Issue[];
}

export interface NormalizedUrl {
	url: URL;
	wasNormalized: boolean;
	denormalize(url?: string | URL): URL;
}

export type LoadProperties<T extends Record<string, any> | void> = T extends void ? undefined : T;

type ActionData<T> = T extends ActionFailure<infer Data> ? Data : T extends void ? undefined : T;
type UnionKeys<T> = T extends unknown ? keyof T : never;
type AccessibleUnion<T, Keys extends PropertyKey = UnionKeys<T>> = T extends unknown
	? T & { [K in Exclude<Keys, keyof T>]?: never }
	: never;
export type AwaitedActions<T extends Record<string, (...args: any) => any>> = AccessibleUnion<
	{
		[K in keyof T]: ActionData<Awaited<ReturnType<T[K]>>>;
	}[keyof T]
>;
