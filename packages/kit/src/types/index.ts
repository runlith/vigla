/// <reference path="../../types/index.d.ts" preserve="true" />
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
	ActionFailure,
	ErrorFunction,
	HttpError,
	NormalizedUrl,
	Redirect,
	RedirectOptions,
	RedirectStatus,
	ValidationError
} from './outcomes.ts';

export type {
	Adapter,
	AdapterViteConfig,
	Builder,
	Emulator,
	PrerenderOption,
	RouteDefinition
} from './builder.ts';
export type {
	Action,
	Actions,
	Cookies,
	Load,
	LoadEvent,
	NavigationEvent,
	RequestEvent,
	RequestHandler,
	Server,
	ServerInitOptions,
	ServerLoad,
	ServerLoadEvent,
	Snapshot
} from './request.ts';
export type {
	ActionFailure,
	AwaitedActions,
	HttpError,
	LoadProperties,
	Redirect,
	ValidationError
} from './outcomes.ts';

export declare const error: ErrorFunction;
export declare function isHttpError<Status extends number>(
	value: unknown,
	status?: Status
): value is HttpError & { status: Status extends undefined ? never : Status };
export declare function redirect(
	status: RedirectStatus | (number & {}),
	location: string | URL,
	options?: RedirectOptions
): never;
export declare function isRedirect(value: unknown): value is Redirect;
export declare function json(data: any, init?: ResponseInit): Response;
export declare function text(body: string, init?: ResponseInit): Response;
export declare function fail(status: number): ActionFailure<undefined>;
export declare function fail<T = undefined>(status: number, data: T): ActionFailure<T>;
export declare function isActionFailure(value: unknown): value is ActionFailure<undefined>;
export declare function invalid(...issues: (StandardSchemaV1.Issue | string)[]): never;
export declare function isValidationError(value: unknown): value is ValidationError;
export declare function normalizeUrl(url: URL | string): NormalizedUrl;
export declare const VERSION: string;
