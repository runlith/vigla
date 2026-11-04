/// <reference path="../types/history.d.ts" preserve="true" />
import './adopt.ts';
import { DEV } from 'esm-env';
import { error as raise } from '@vigla/kit';
import { warnDiagnostic } from './history/diagnostics.ts';

export * from '@vigla/kit';
export const VERSION = '3.1.0';

export type ErrorProperties = Omit<App.Error, 'status' | 'message'>;
export type LegacyErrorBody = Omit<App.Error, 'status'> & { status?: App.Error['status'] };
export type ErrorFunction = typeof raise & ((status: number, body: LegacyErrorBody) => never);

type Raise = (status: number, message?: string, properties?: ErrorProperties) => never;

export const error = ((
	status: number,
	message?: string | LegacyErrorBody,
	properties?: ErrorProperties
): never => {
	if (message === undefined || typeof message === 'string')
		return (raise as Raise)(status, message, properties);
	if (DEV)
		warnDiagnostic(
			'error_body_deprecated',
			'Passing an `App.Error` body as the second argument is deprecated — pass the `message` as the second argument, and any additional properties as the third'
		);
	const { message: text, ...rest } = message;
	return (raise as Raise)(status, text, rest);
}) as ErrorFunction;
