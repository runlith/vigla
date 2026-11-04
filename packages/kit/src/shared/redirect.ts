import type { RedirectOptions } from '../types/outcomes.ts';
import type { Diagnostics } from './diagnostics.ts';
import {
	redirect_external_javascript,
	redirect_external_not_allowed,
	redirect_external_not_in_allowlist,
	redirect_external_option_invalid
} from './errors.ts';

const base = 'https://redirect.invalid';

export function matchesOrigin(location: string, allowed: string): boolean {
	if (location === allowed) return true;
	try {
		const origin = new URL(allowed);
		const target = new URL(location, origin);
		return target.protocol === origin.protocol && target.host === origin.host;
	} catch {
		return false;
	}
}

export function validateRedirect(
	d: Diagnostics,
	location: string,
	options?: RedirectOptions,
	origin?: string
): void {
	if (matchesOrigin(location, origin ?? base)) return;
	const external = options?.external;
	const values = { location: JSON.stringify(location) };
	if (!external) redirect_external_not_allowed(values, d);
	if (external === true) {
		let protocol: string | undefined;
		try {
			protocol = new URL(location, base).protocol;
		} catch {}
		if (protocol === 'javascript:' || protocol === 'data:') redirect_external_javascript(values, d);
		return;
	}
	if (Array.isArray(external)) {
		if (!external.some((allowed) => matchesOrigin(location, allowed)))
			redirect_external_not_in_allowlist(values, d);
		return;
	}
	redirect_external_option_invalid(d);
}
