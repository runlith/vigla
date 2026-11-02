import { DEV } from 'esm-env';
import type { TrailingSlash } from '../types/internal/data.ts';
import { url_hash_unavailable } from './errors.ts';

export function decodePathname(path: string): string {
	return path
		.split('%25')
		.map((part) => decodeURI(part))
		.join('%25');
}

export function normalizePath(path: string, slash: TrailingSlash): string {
	if (path === '/' || slash === 'ignore') return path;
	if (slash === 'always') return path.endsWith('/') ? path : `${path}/`;
	return path.endsWith('/') ? path.slice(0, -1) : path;
}

export function relativePathname(from: string, to: string): string {
	const segment = to.replace(/\/$/, '').split('/').at(-1);
	return from.endsWith('/') ? `../${segment}` : `./${segment}/`;
}

export function stripHash(url: { href: string }): string {
	return url.href.split('#')[0]!;
}

const inspectCustom = Symbol.for('nodejs.util.inspect.custom');

function inspectAs(
	value: () => object
): (depth: number, options: object, inspect: (value: object, options: object) => string) => string {
	return (_depth, options, inspect) => inspect(value(), options);
}

export function makeTrackable(
	url: URL,
	onUrl: () => void,
	onSearch: (name: string) => void,
	allowHash = false
): URL {
	const copy = new URL(url);
	Object.defineProperty(copy.searchParams, inspectCustom, {
		configurable: true,
		value: inspectAs(() => new URL(url.href).searchParams)
	});
	const search = new Proxy(copy.searchParams, {
		get(target, key) {
			if (key === 'get' || key === 'getAll' || key === 'has') {
				return (name: string, value?: string) => {
					onSearch(name);
					return key === 'has' ? target.has(name, value) : target[key](name);
				};
			}
			onUrl();
			const value: unknown = Reflect.get(target, key, target);
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	Object.defineProperty(copy, 'searchParams', {
		enumerable: true,
		configurable: true,
		value: search
	});
	const properties: Array<keyof URL> = ['href', 'pathname', 'search', 'toJSON', 'toString'];
	if (allowHash) properties.push('hash');
	for (const property of properties) {
		Object.defineProperty(copy, property, {
			enumerable: true,
			configurable: true,
			get() {
				onUrl();
				const value = url[property];
				return typeof value === 'function' ? value.bind(url) : value;
			}
		});
	}
	if (DEV && !allowHash)
		Object.defineProperty(copy, 'hash', { configurable: true, get: url_hash_unavailable });
	Object.defineProperty(copy, inspectCustom, {
		configurable: true,
		value: inspectAs(() => new URL(url.href))
	});
	return copy;
}
