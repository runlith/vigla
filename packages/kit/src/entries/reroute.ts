import type { RerouteNext } from '../types/adapter.ts';
import type { Identity } from '../types/identity.ts';
import type { MaybePromise } from '../types/value.ts';

export type ApplyReroute = (response: Response, next: RerouteNext) => MaybePromise<Response>;

export function rerouter(identity: Identity): ApplyReroute {
	const header = `x-${identity.name}-rerouted-url`;
	return (response, next) => {
		const location = response.headers.get(header);
		return location ? next(new URL(location)) : response;
	};
}
