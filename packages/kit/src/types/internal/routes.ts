export interface RouteParam {
	name: string;
	matcher?: string;
	optional: boolean;
	rest: boolean;
	chained: boolean;
}

export interface PageOptions {
	ssr?: boolean;
	csr?: boolean;
	prerender?: boolean | 'auto';
	trailingSlash?: 'always' | 'never' | 'ignore';
	config?: unknown;
	entries?: unknown;
	load?: null;
}

export interface PageNode {
	depth: number;
	component?: string;
	universal?: string;
	server?: string;
	parent: number | null;
	options: PageOptions | null;
}

export interface PageBranch {
	layouts: Array<number | undefined>;
	errors: Array<number | undefined>;
	leaf: number;
}

export interface Endpoint {
	file: string;
	options: PageOptions | null;
}

export interface Route {
	id: string;
	parent: string | null;
	segment: string;
	pattern: RegExp;
	params: RouteParam[];
	layout: number | null;
	error: number | null;
	leaf: number | null;
	page: PageBranch | null;
	endpoint: Endpoint | null;
}

export interface RouteAsset {
	file: string;
	type: string | null;
}

export interface RouteHooks {
	client: string | null;
	server: string | null;
	universal: string | null;
}

export interface RouteTree {
	assets: RouteAsset[];
	hooks: RouteHooks;
	params: string | null;
	nodes: PageNode[];
	routes: Route[];
}

export interface RoutePattern {
	pattern: RegExp;
	params: RouteParam[];
}
