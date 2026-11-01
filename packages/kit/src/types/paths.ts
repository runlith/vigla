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
type Only<Id extends string, Other extends string> = string extends Id
	? string
	: Exclude<Id, Other>;
type Both<Id extends string, Other extends string> = string extends Id
	? string
	: Extract<Id, Other>;
export type ManifestRoute =
	| { id: Only<PageRouteId, EndpointRouteId>; page: true; endpoint: false }
	| { id: Only<EndpointRouteId, PageRouteId>; page: false; endpoint: true }
	| { id: Both<PageRouteId, EndpointRouteId>; page: true; endpoint: true };
