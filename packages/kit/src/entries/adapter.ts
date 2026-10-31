import type { RerouteNext } from '../types/adapter.ts';
import type { MaybePromise } from '../types/value.ts';

export function applyReroute(response: Response, next: RerouteNext): MaybePromise<Response> {
	const location = response.headers.get('x-sveltekit-rerouted-url');
	return location ? next(new URL(location)) : response;
}
