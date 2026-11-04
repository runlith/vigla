import { BROWSER, DEV } from 'esm-env';
import { getOrigin } from '#internal/origin';
import type { Identity } from '../types/identity.ts';
import type {
	ErrorFunction,
	ErrorProperties,
	RedirectOptions,
	RedirectStatus
} from '../types/outcomes.ts';
import { HttpError, Redirect } from '../shared/outcomes.ts';
import { diagnostics } from '../shared/diagnostics.ts';
import { invalid_error_status, invalid_redirect_status } from '../shared/errors.ts';
import { validateRedirect } from '../shared/redirect.ts';

export type RedirectFunction = (
	status: number,
	location: string | URL,
	options?: RedirectOptions
) => never;

export interface Outcomes {
	error: ErrorFunction;
	redirect: RedirectFunction;
}

export function outcomes(identity: Identity): Outcomes {
	const d = diagnostics(identity);
	const error: ErrorFunction = (
		status: number,
		message?: string,
		properties?: ErrorProperties
	): never => {
		if ((!BROWSER || DEV) && (isNaN(status) || status < 400 || status > 599))
			invalid_error_status({ status: String(status) }, d);
		throw new HttpError({ ...properties, status, message: message ?? `Error: ${status}` });
	};
	const redirect = (status: number, location: string | URL, options?: RedirectOptions): never => {
		if ((!BROWSER || DEV) && (isNaN(status) || status < 300 || status > 308))
			invalid_redirect_status({ status: String(status) }, d);
		const href = location.toString();
		validateRedirect(d, href, options, getOrigin());
		throw new Redirect(status as RedirectStatus, href);
	};
	return { error, redirect };
}
