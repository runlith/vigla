import type { EndpointRouteId, PageRouteId, RouteId, RouteParams } from '$app/types';

export type StripFragment<T extends string> = T extends `${infer Path}?${string}`
	? Path
	: T extends `${infer Path}#${string}`
		? Path
		: T;
export type ResolveArgs<T> = T extends `/${string}`
	? StripFragment<T> extends infer Id extends RouteId
		? RouteParams<Id> extends Record<string, never>
			? [route: T]
			: [route: T, params: RouteParams<Id>]
		: [never]
	: [pathname: T];
export type RouteMatch = { [Id in RouteId]: { id: Id; params: RouteParams<Id> } }[RouteId];
export interface ManifestPath<Path extends string = string> {
	path: Path;
}
export type ManifestRoute =
	| { id: Exclude<PageRouteId, EndpointRouteId>; page: true; endpoint: false }
	| { id: Exclude<EndpointRouteId, PageRouteId>; page: false; endpoint: true }
	| { id: Extract<PageRouteId, EndpointRouteId>; page: true; endpoint: true };
