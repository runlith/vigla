import type {
	PathnameWithSearchOrHash,
	ResolvedPathname,
	RouteIdWithSearchOrHash,
	AssetPath
} from '$app/types';
import type { ResolveArgs, RouteMatch } from '../types/paths.ts';
import type { ParamValue } from '../types/params.ts';
import { resolveRoute } from '../shared/routing/index.ts';
import { resolve_params_missing } from '../shared/errors.ts';
import { base, assets, hashRouting } from './payload.ts';

export { base, assets, appDir as app_dir } from './payload.ts';
let matcher: (url: URL | string) => Promise<RouteMatch | null> = async () => null;

export function setMatcher(value: typeof matcher): void {
	matcher = value;
}

export function asset(file: AssetPath): string {
	return `${assets || base}/${file}`;
}

export function resolve<T extends RouteIdWithSearchOrHash | PathnameWithSearchOrHash>(
	...args: ResolveArgs<T>
): ResolvedPathname {
	const [id, params] = args as [string, Record<string, ParamValue | undefined>?];
	if (id.startsWith('/') && id.includes('[') && !params) resolve_params_missing({ id });
	const path = id.startsWith('/') ? resolveRoute(id, params ?? {}) : `/${id}`;
	return `${hashRouting ? '#' : base}${path}` as ResolvedPathname;
}

export function match(url: URL | string): Promise<RouteMatch | null> {
	return matcher(url);
}
