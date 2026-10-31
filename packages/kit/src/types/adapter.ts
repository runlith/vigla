import type { MaybePromise } from './value.ts';

export type RerouteNext = (url: URL) => MaybePromise<Response>;
export declare function applyReroute(response: Response, next: RerouteNext): MaybePromise<Response>;
