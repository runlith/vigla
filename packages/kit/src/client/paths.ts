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
import { asset_leading_slash } from '../shared/warnings.ts';
import { DEV } from 'esm-env';
import { base, assets, hashRouting } from './payload.ts';

export { base, assets, appDir as app_dir } from './payload.ts';
let matcher: (url: URL | string) => Promise<RouteMatch | null> = async () => null;

export function setMatcher(value: typeof matcher): void {
	matcher = value;
}

export function asset(file: AssetPath): string {
	let path: string = file;
	if (path.startsWith('/')) {
		if (DEV) asset_leading_slash({ path, fixed: path.slice(1) });
		path = path.slice(1);
	}
	return `${assets || base}/${path}`;
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
