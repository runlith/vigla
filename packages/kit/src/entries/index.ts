import { BROWSER, DEV } from 'esm-env';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
	ErrorFunction,
	ErrorProperties,
	HttpError as HttpErrorContract,
	LegacyErrorBody,
	RedirectOptions,
	RedirectStatus
} from '../types/outcomes.ts';
import { HttpError, Redirect, ActionFailure, ValidationError } from '../shared/outcomes.ts';
import { invalid_error_status, invalid_redirect_status } from '../shared/errors.ts';
import { error_body_deprecated } from '../shared/warnings.ts';
import { validateRedirect } from '../shared/redirect.ts';
import { version } from '../../package.json' with { type: 'json' };

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
export const VERSION = version;

export const error: ErrorFunction = (
	status: number,
	message?: string | LegacyErrorBody,
	properties?: ErrorProperties
): never => {
	if ((!BROWSER || DEV) && (isNaN(status) || status < 400 || status > 599))
		invalid_error_status({ status: String(status) });
	if (message !== undefined && typeof message !== 'string') {
		if (DEV) error_body_deprecated();
		const { message: text, ...rest } = message;
		message = text;
		properties = rest;
	}
	throw new HttpError({ ...properties, status, message: message ?? `Error: ${status}` });
};

export function isHttpError<Status extends number>(
	value: unknown,
	status?: Status
): value is HttpErrorContract & { status: Status extends undefined ? never : Status } {
	return value instanceof HttpError && (!status || value.status === status);
}
export function redirect(status: number, location: string | URL, options?: RedirectOptions): never {
	if ((!BROWSER || DEV) && (isNaN(status) || status < 300 || status > 308))
		invalid_redirect_status({ status: String(status) });
	const href = location.toString();
	validateRedirect(href, options, BROWSER ? globalThis.location.origin : undefined);
	throw new Redirect(status as RedirectStatus, href);
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
