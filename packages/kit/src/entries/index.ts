import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ErrorFunction, HttpError as HttpErrorContract } from '../types/outcomes.ts';
import { HttpError, Redirect, ActionFailure, ValidationError } from '../shared/outcomes.ts';
import { identity } from '../shared/identity.ts';
import { outcomes, type RedirectFunction } from './outcomes.ts';

export type {
	ActionFailure,
	Adapter,
	AdapterViteConfig,
	AwaitedActions,
	Builder,
	Cookies,
	Emulator,
	HttpError,
	Load,
	LoadEvent,
	LoadProperties,
	NavigationEvent,
	PrerenderOption,
	Redirect,
	RequestEvent,
	RequestHandler,
	RouteDefinition,
	Server,
	ServerInitOptions,
	ServerLoad,
	ServerLoadEvent,
	Snapshot,
	Action,
	Actions,
	ValidationError
} from '../types/index.ts';
export { normalizeUrl } from '../shared/pathname.ts';
export const VERSION = '0.1.0';

const bound = outcomes(identity);
export const error: ErrorFunction = bound.error;
export const redirect: RedirectFunction = bound.redirect;

export function isHttpError<Status extends number>(
	value: unknown,
	status?: Status
): value is HttpErrorContract & { status: Status extends undefined ? never : Status } {
	return value instanceof HttpError && (!status || value.status === status);
}
export function isRedirect(value: unknown): value is Redirect {
	return value instanceof Redirect;
}

const encoder = new TextEncoder();
export function json(data: any, init?: ResponseInit): Response {
	const body = JSON.stringify(data);
	const headers = new Headers(init?.headers);
	if (!headers.has('content-length'))
		headers.set('content-length', String(encoder.encode(body).byteLength));
	if (!headers.has('content-type')) headers.set('content-type', 'application/json');
	return new Response(body, { ...init, headers });
}
export function text(body: string, init?: ResponseInit): Response {
	const headers = new Headers(init?.headers);
	if (headers.has('content-length')) return new Response(body, { ...init, headers });
	const bytes = encoder.encode(body);
	headers.set('content-length', String(bytes.byteLength));
	return new Response(bytes, { ...init, headers });
}
export function fail(status: number): ActionFailure<undefined>;
export function fail<T = undefined>(status: number, data: T): ActionFailure<T>;
export function fail<T>(status: number, data?: T): ActionFailure<T | undefined> {
	return new ActionFailure(status, data);
}
export function isActionFailure(value: unknown): value is ActionFailure<undefined> {
	return value instanceof ActionFailure;
}
export function invalid(...issues: (StandardSchemaV1.Issue | string)[]): never {
	throw new ValidationError(
		issues.map((issue) => (typeof issue === 'string' ? { message: issue } : issue))
	);
}
export function isValidationError(value: unknown): value is ValidationError {
	return value instanceof ValidationError;
}
