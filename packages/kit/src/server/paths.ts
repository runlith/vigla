import type { ServerPaths } from '../types/internal/server.ts';
import { findRequest, runRequest } from './scope.ts';
import { findRoute, resolveRoute } from '../shared/routing/index.ts';
import { decodePathname } from '../shared/url.ts';
import { addDataSuffix } from '../shared/pathname.ts';
import type { RouteMatch } from '../types/paths.ts';
import { resolve_params_missing } from '../shared/errors.ts';
import { asset_leading_slash } from '../shared/warnings.ts';
import { identity } from '../shared/identity.ts';

let configured: ServerPaths = { base: '', assets: '', relative: true };
export let base = '';
export let assets = '';
export let app_dir = '_app';

export function configurePaths(paths: ServerPaths, appDir: string): void {
	configured = paths;
	base = paths.base;
	assets = paths.assets || paths.base;
	app_dir = appDir;
}
export function paths(): ServerPaths {
	return findRequest()?.options.paths ?? configured;
}
export function appDirectory(): string {
	return findRequest()?.manifest.app_dir ?? app_dir;
}
export function asset(file: string): string {
	if (file.startsWith('/')) {
		asset_leading_slash({ path: file, fixed: file.slice(1) });
		file = file.slice(1);
	}
	return paths().assets && paths().assets !== paths().base
		? `${paths().assets}/${file}`
		: resolve(file);
}
export function resolve(route: string, params?: Record<string, any>): string {
	if (route.startsWith('/') && route.includes('[') && !params)
		resolve_params_missing({ id: route });
	const resolved = route.startsWith('/') ? resolveRoute(route, params ?? {}) : `/${route}`;
	const store = findRequest();
	if (paths().relative && store && !store.state.prerendering?.fallback) {
		const path = store.event.isDataRequest
			? addDataSuffix(store.event.url.pathname)
			: store.event.url.pathname;
		return documentPaths(path, paths()).base + resolved;
	}
	return paths().base + resolved;
}
export async function match(value: URL | string): Promise<RouteMatch | null> {
	const store = findRequest();
	if (!store) return null;
	const url = value instanceof URL ? value : new URL(value, store.event.url);
	let path: string;
	try {
		path = decodePathname(
			(await runRequest(store, () =>
				store.hooks.reroute?.({ url: new URL(url), fetch: store.event.fetch })
			)) ?? url.pathname
		);
	} catch {
		return null;
	}
	const base = store.options.paths.base;
	if (base && path !== base && !path.startsWith(`${base}/`)) return null;
	const result = findRoute(
		path.slice(base.length) || '/',
		store.manifest.routes,
		await store.manifest.matchers()
	);
	return result ? ({ id: result.route.id, params: result.params } as RouteMatch) : null;
}

export interface DocumentPaths {
	base: string;
	assets: string;
}

export function documentPaths(pathname: string, source: ServerPaths): DocumentPaths {
	if (!source.relative) return { base: source.base, assets: source.assets || source.base };
	const depth = pathname.slice(source.base.length).split('/').slice(2).length;
	const base = Array.from({ length: depth }, () => '..').join('/') || '.';
	return {
		base,
		assets:
			!source.assets || (source.assets.startsWith('/') && source.assets !== identity.assets)
				? base
				: source.assets
	};
}

export function clientPath(file: string, paths: DocumentPaths): string {
	return file.startsWith('/') ? paths.base + file : `${paths.assets}/${file}`;
}
