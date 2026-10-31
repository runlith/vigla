import type { LayoutParams, ResolvedPathname, RouteId } from '$app/types';
import type { Route } from './request.ts';
import type { ParamValue } from './params.ts';

export type ReadonlyURLSearchParams = Omit<URLSearchParams, 'set' | 'append' | 'delete' | 'sort'>;
export type ReadonlyURL = Readonly<
	Omit<URL, 'searchParams'> & { searchParams: ReadonlyURLSearchParams }
>;
export interface ShallowNavigation<Params extends Record<string, ParamValue> = LayoutParams<'/'>> {
	params: Params | null;
	route: Route<RouteId> | null;
	url: ReadonlyURL;
}
export interface Page<
	Params extends Record<string, ParamValue> = LayoutParams<'/'>,
	Id extends RouteId | null = RouteId | null
> {
	url: ReadonlyURL & { readonly pathname: ResolvedPathname | (string & {}) };
	params: Params;
	route: Route<Id>;
	status: number;
	error: App.Error | null;
	data: App.PageData & Record<string, any>;
	state: App.PageState;
	shallow: ShallowNavigation<LayoutParams<'/'> | Params> | null;
	form: any;
}
export interface Updated {
	readonly current: boolean;
	check(): Promise<boolean>;
}
