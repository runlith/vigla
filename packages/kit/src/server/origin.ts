import { findRequest } from './scope.ts';

export function getOrigin(): string | undefined {
	const url = findRequest()?.event.request.url;
	return url === undefined ? undefined : new URL(url).origin;
}
