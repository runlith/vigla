import type { Span } from '@opentelemetry/api';
import type { ParseOptions, SerializeOptions, parseSetCookie } from 'cookie';
import type { LayoutParams, RouteId } from '$app/types';
import type { MaybePromise } from './value.ts';
import type { ParamValue } from './params.ts';
import type { AsyncStore } from 'vigla';
import type { Read } from './internal/server.ts';

export interface CookieValue {
	name: string;
	value: string;
}
export interface Cookies {
	get(name: string, options?: ParseOptions): string | undefined;
	getAll(options?: ParseOptions): CookieValue[];
	set(name: string, value: string, options?: SerializeOptions): void;
	delete(name: string, options?: SerializeOptions): void;
	parse: typeof parseSetCookie;
	serialize(name: string, value: string, options?: SerializeOptions): string;
}
export interface Route<Id> {
	id: Id;
}
export interface Tracing {
	enabled: boolean;
	root: Span;
	current: Span;
}
export interface NavigationEvent<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Id extends RouteId | null = RouteId | null
> {
	params: Params;
	route: Route<Id>;
	url: URL;
}
export interface RequestEvent<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Id extends RouteId | null = RouteId | null
> {
	readonly cookies: Cookies;
	readonly fetch: typeof fetch;
	readonly getClientAddress: () => string;
	readonly locals: App.Locals;
	readonly params: Params;
	readonly platform: Readonly<App.Platform> | undefined;
	readonly request: Request;
	readonly route: Route<Id>;
	readonly setHeaders: (headers: Record<string, string>) => void;
	readonly url: URL;
	readonly isDataRequest: boolean;
	readonly isSubRequest: boolean;
	readonly isRemoteRequest: boolean;
	readonly tracing: Tracing;
}
export interface LoadEvent<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Data extends Record<string, unknown> | null = Record<string, any> | null,
	Parent extends Record<string, unknown> = Record<string, any>,
	Id extends RouteId | null = RouteId | null
> extends NavigationEvent<Params, Id> {
	fetch: typeof fetch;
	data: Data;
	setHeaders(headers: Record<string, string>): void;
	parent(): Promise<Parent>;
	depends(...dependencies: `${string}:${string}`[]): void;
	untrack<T>(fn: () => T): T;
	tracing: Tracing;
}
export type Load<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Data extends Record<string, unknown> | null = Record<string, any> | null,
	Parent extends Record<string, unknown> = Record<string, any>,
	Output extends Record<string, unknown> | void = Record<string, any> | void,
	Id extends RouteId | null = RouteId | null
> = (event: LoadEvent<Params, Data, Parent, Id>) => MaybePromise<Output>;

export interface ServerLoadEvent<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Parent extends Record<string, any> = Record<string, any>,
	Id extends RouteId | null = RouteId | null
> extends RequestEvent<Params, Id> {
	parent(): Promise<Parent>;
	depends(...dependencies: string[]): void;
	untrack<T>(fn: () => T): T;
	tracing: Tracing;
}
export type ServerLoad<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Parent extends Record<string, any> = Record<string, any>,
	Output extends Record<string, any> | void = Record<string, any> | void,
	Id extends RouteId | null = RouteId | null
> = (event: ServerLoadEvent<Params, Parent, Id>) => MaybePromise<Output>;
export type Action<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Output extends Record<string, any> | void = Record<string, any> | void,
	Id extends RouteId | null = RouteId | null
> = (event: RequestEvent<Params, Id>) => MaybePromise<Output>;
export type Actions<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Output extends Record<string, any> | void = Record<string, any> | void,
	Id extends RouteId | null = RouteId | null
> = Record<string, Action<Params, Output, Id>>;
export type RequestHandler<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Id extends RouteId | null = RouteId | null
> = (event: RequestEvent<Params, Id>) => MaybePromise<Response>;
export interface Snapshot<T = any> {
	capture(): T;
	restore(value: T): void;
}
export interface ServerInitOptions {
	env: Record<string, string | undefined>;
	read?: Read;
	scope?: AsyncStore;
}
export interface RequestOptions {
	getClientAddress(): string;
	platform?: App.Platform;
	read?: Read;
}
export interface Server {
	init(options: ServerInitOptions): Promise<void>;
	respond(request: Request, options: RequestOptions): Promise<Response>;
}
