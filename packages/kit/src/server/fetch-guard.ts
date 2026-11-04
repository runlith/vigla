import { findRequest } from './scope.ts';
import * as errors from './errors.ts';
import * as warnings from './warnings.ts';
import { SCHEME } from '../shared/url.ts';

const decoded = new WeakMap<Response, Error>();
let watching = false;

function capture(fn: () => never): Error {
	try {
		fn();
	} catch (error) {
		return error as Error;
	}
	throw new Error('unreachable');
}

export function watchDecodedResponses(): void {
	if (watching) return;
	watching = true;
	const original = globalThis.fetch;
	globalThis.fetch = async (info, init) => {
		const response = await original(info, init);
		const encoding = response.headers.get('content-encoding');
		if (encoding)
			decoded.set(
				response,
				capture(() => errors.fetch_response_decoded({ encoding }))
			);
		return response;
	};
}

export function reportDecodedResponse(
	response: Response,
	fixStack?: (error: Error) => Error
): void {
	const error = decoded.get(response);
	if (error) console.error(fixStack ? fixStack(error) : error);
}

export async function guardRenderFetch<T>(render: () => PromiseLike<T>): Promise<T> {
	const original = globalThis.fetch;
	let warned = false;
	globalThis.fetch = (info, init) => {
		if (typeof info === 'string' && !SCHEME.test(info))
			errors.ssr_fetch_relative_url({ url: info });
		const remote = findRequest()?.remote;
		if (!warned && !remote?.query && !remote?.prerender && !remote?.mutation) {
			warnings.ssr_fetch_eager();
			warned = true;
		}
		return original(info, init);
	};
	try {
		return await render();
	} finally {
		globalThis.fetch = original;
	}
}
