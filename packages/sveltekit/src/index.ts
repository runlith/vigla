import { DEV } from 'esm-env';
import type { redirect as kitRedirect } from '@vigla/kit';
import { outcomes } from '@vigla/kit/internal/identity';
import { warnDiagnostic } from './history/diagnostics.ts';
import { identity } from './identity.ts';
import type { ErrorFunction, ErrorProperties, LegacyErrorBody } from './types/index.ts';

export * from '@vigla/kit';
export type {
	AdapterEntry,
	Builder,
	ErrorFunction,
	ErrorProperties,
	LegacyErrorBody
} from './types/index.ts';
export const VERSION = '3.1.11';

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
