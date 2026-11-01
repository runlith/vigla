import { findRequest } from './scope.ts';

export function getOrigin(): string | undefined {
	return findRequest()?.event.url.origin;
}
