import type { NormalizedUrl } from '../types/outcomes.ts';

export function hasDataSuffix(pathname: string): boolean {
	return pathname.endsWith('/__data.json') || pathname.endsWith('.html__data.json');
}
export function hasResolutionSuffix(pathname: string): boolean {
	return pathname.endsWith('/__route.js') || pathname.endsWith('.html__route.js');
}
export function addDataSuffix(pathname: string): string {
	return pathname.endsWith('.html')
		? pathname + '__data.json'
		: pathname.replace(/\/$/, '') + '/__data.json';
}
export function addResolutionSuffix(pathname: string): string {
	return pathname.endsWith('.html')
		? pathname + '__route.js'
		: pathname.replace(/\/$/, '') + '/__route.js';
}
export function stripDataSuffix(pathname: string): string {
	return pathname.endsWith('.html__data.json')
		? pathname.slice(0, -'__data.json'.length)
		: pathname.slice(0, -'/__data.json'.length);
}
export function stripResolutionSuffix(pathname: string): string {
	return pathname.endsWith('.html__route.js')
		? pathname.slice(0, -'__route.js'.length)
		: pathname.slice(0, -'/__route.js'.length);
}
export function normalizeUrl(input: URL | string): NormalizedUrl {
	const url = new URL(input, 'a://a');
	const suffix = hasResolutionSuffix(url.pathname)
		? 'route'
		: hasDataSuffix(url.pathname)
			? 'data'
			: null;
	const trailingSlash = url.pathname !== '/' && url.pathname.endsWith('/');
	if (suffix === 'route') url.pathname = stripResolutionSuffix(url.pathname);
	else if (suffix === 'data') url.pathname = stripDataSuffix(url.pathname);
	else if (trailingSlash) url.pathname = url.pathname.slice(0, -1);
	return {
		url,
		wasNormalized: suffix !== null || trailingSlash,
		denormalize(input = url) {
			const result = new URL(input, url);
			if (suffix === 'route') result.pathname = addResolutionSuffix(result.pathname);
			else if (suffix === 'data') result.pathname = addDataSuffix(result.pathname);
			else if (trailingSlash && !result.pathname.endsWith('/')) result.pathname += '/';
			return result;
		}
	};
}
