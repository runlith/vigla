/// <reference path="../types/history.d.ts" preserve="true" />
import { DEV } from 'esm-env';
import type {
	Builder as KitBuilder,
	error as kitError,
	redirect as kitRedirect,
	RouteDefinition
} from '@vigla/kit';
import { outcomes } from '@vigla/kit/internal/identity';
import { warnDiagnostic } from './history/diagnostics.ts';
import { identity } from './identity.ts';

export * from '@vigla/kit';
export const VERSION = '3.1.0';

export type ErrorProperties = Omit<App.Error, 'status' | 'message'>;
export type LegacyErrorBody = Omit<App.Error, 'status'> & { status?: App.Error['status'] };
export type ErrorFunction = typeof kitError & ((status: number, body: LegacyErrorBody) => never);

export interface AdapterEntry {
	id: string;
	filter(route: RouteDefinition): boolean;
	complete(entry: {
		generateManifest(options: { relativePath: string }): string;
	}): void | Promise<void>;
}
export interface Builder extends KitBuilder {
	createEntries?: (fn: (route: RouteDefinition) => AdapterEntry) => Promise<void>;
	generateManifest?: (options: { relativePath: string; routes?: RouteDefinition[] }) => string;
}

type Raise = (status: number, message?: string, properties?: ErrorProperties) => never;

const bound = outcomes(identity);
const raise = bound.error as Raise;

export const redirect: typeof kitRedirect = bound.redirect;

export const error = ((
	status: number,
	message?: string | LegacyErrorBody,
	properties?: ErrorProperties
): never => {
	if (message === undefined || typeof message === 'string')
		return raise(status, message, properties);
	if (DEV)
		warnDiagnostic(
			'error_body_deprecated',
			'Passing an `App.Error` body as the second argument is deprecated — pass the `message` as the second argument, and any additional properties as the third'
		);
	const { message: text, ...rest } = message;
	return raise(status, text, rest);
}) as ErrorFunction;
