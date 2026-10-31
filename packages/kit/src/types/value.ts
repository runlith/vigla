export type MaybePromise<T> = T | Promise<T>;
export type DeepPartial<T> = T extends Record<PropertyKey, unknown> | unknown[]
	? { [K in keyof T]?: DeepPartial<T[K]> }
	: T | undefined;
export type IsAny<T> = 0 extends 1 & T ? true : false;
export type UnionKeys<T> = T extends unknown ? keyof T : never;
export type UnionValue<T, K extends PropertyKey> = T extends unknown
	? K extends keyof T
		? T[K]
		: never
	: never;
