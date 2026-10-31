import { parseCookie, parseSetCookie, stringifySetCookie } from 'cookie';
import type { ParseOptions, SerializeOptions } from 'cookie';
import type { Cookies } from '../types/request.ts';
import type { TrailingSlash } from '../types/internal/data.ts';
import { addDataSuffix } from '../shared/pathname.ts';
import * as errors from './errors.ts';
import * as warnings from './warnings.ts';

interface Cookie {
	name: string;
	value: string;
	options: SerializeOptions & { path: string };
}

export class CookieJar {
	readonly cookies: Cookies;
	readonly #url: URL;
	readonly #header: string;
	readonly #raw: Record<string, string | undefined>;
	readonly #changes = new Map<string, Cookie>();
	readonly #queue: Array<() => void> = [];
	readonly #defaults: SerializeOptions;
	readonly #paths?: Map<string, Set<string>>;
	readonly #dev: boolean;
	#parsed?: Record<string, string | undefined>;
	#normalized: string | null = null;
	#sealed = false;

	constructor(request: Request, url: URL, dev: boolean, paths?: Map<string, Set<string>>) {
		this.#url = url;
		this.#header = request.headers.get('cookie') ?? '';
		this.#raw = parseCookie(this.#header, { decode: (value) => value });
		this.#dev = dev;
		this.#paths = paths;
		this.#defaults = {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev && !(url.hostname === 'localhost' && url.protocol === 'http:')
		};
		this.cookies = {
			get: (name, options) => {
				const current = this.#best(name);
				if (current) return current.options.maxAge === 0 ? undefined : current.value;
				const value = this.#parse(options)[name];
				if (dev && value === undefined) {
					const paths = [...(this.#paths?.get(name) ?? [])].filter(
						(path) => path !== url.pathname && pathMatches(path, url.pathname)
					);
					if (paths.length)
						warnings.cookie_path_mismatch({
							name,
							pathname: url.pathname,
							paths: paths.join(' and ')
						});
				}
				return value;
			},
			getAll: (options) => {
				const values = { ...this.#parse(options) };
				for (const name of new Set([...this.#changes.values()].map((cookie) => cookie.name))) {
					const cookie = this.#best(name);
					if (cookie) values[name] = cookie.options.maxAge === 0 ? undefined : cookie.value;
				}
				return Object.entries(values).flatMap(([name, value]) =>
					value === undefined ? [] : [{ name, value }]
				);
			},
			set: (name, value, options) => this.set(name, value, { ...this.#defaults, ...options }),
			delete: (name, options) => this.set(name, '', { ...this.#defaults, ...options, maxAge: 0 }),
			parse: parseSetCookie,
			serialize: (name, value, options = {}) => {
				const path = this.#path(options.path ?? '/', options.domain, true);
				const { encode, ...attributes } = { ...this.#defaults, ...options, path };
				return stringifySetCookie({ name, value, ...attributes }, { encode });
			}
		};
	}

	#parse(options?: ParseOptions): Record<string, string | undefined> {
		if (options?.decode) return parseCookie(this.#header, options);
		return (this.#parsed ??= parseCookie(this.#header));
	}

	#best(name: string): Cookie | undefined {
		let chosen: Cookie | undefined;
		for (const cookie of this.#changes.values()) {
			if (
				cookie.name === name &&
				domainMatches(this.#url.hostname, cookie.options.domain) &&
				pathMatches(this.#url.pathname, cookie.options.path) &&
				(!chosen || cookie.options.path.length > chosen.options.path.length)
			)
				chosen = cookie;
		}
		return chosen;
	}

	#path(path: string, domain?: string, serialize = false): string {
		if (domain && domain !== this.#url.hostname) return path;
		if (this.#normalized === null) {
			if (serialize) errors.cookies_serialize_before_route();
			throw new Error('Cookie path resolved before routing');
		}
		return new URL(path, new URL(this.#normalized, this.#url.origin)).pathname;
	}

	set(name: string, value: string, options: SerializeOptions): void {
		if (this.#sealed) errors.cookies_set_after_response();
		if (this.#normalized === null) {
			this.#queue.push(() => this.set(name, value, options));
			return;
		}
		const path = this.#path(options.path ?? '/', options.domain);
		if (this.#dev) {
			const encoder = new TextEncoder();
			if (
				encoder.encode(name).byteLength +
					encoder.encode((options.encode ?? encodeURIComponent)(value)).byteLength >
				4096
			)
				errors.cookie_too_large({ name });
			if (this.#paths) {
				const paths = this.#paths.get(name) ?? new Set<string>();
				if (value) paths.add(path);
				else paths.delete(path);
				this.#paths.set(name, paths);
			}
		}
		this.#changes.set(`${options.domain ?? ''}${path}?${encodeURIComponent(name)}`, {
			name,
			value,
			options: { ...options, path }
		});
	}

	route(slash: TrailingSlash): void {
		const path = this.#url.pathname;
		this.#normalized =
			slash === 'always' && !path.endsWith('/')
				? `${path}/`
				: slash === 'never' && path !== '/'
					? path.replace(/\/$/, '')
					: path;
		for (const apply of this.#queue.splice(0)) apply();
	}

	header(destination: URL, explicit: string | null): string {
		const values = { ...this.#raw };
		for (const { name, value, options } of this.#changes.values()) {
			if (
				domainMatches(destination.hostname, options.domain) &&
				pathMatches(destination.pathname, options.path)
			)
				values[name] = (options.encode ?? encodeURIComponent)(value);
		}
		if (explicit) Object.assign(values, parseCookie(explicit, { decode: (value) => value }));
		return Object.entries(values)
			.map(([name, value]) => `${name}=${value}`)
			.join('; ');
	}

	apply(headers: Headers): void {
		for (const { name, value, options } of this.#changes.values()) {
			const { encode, ...attributes } = options;
			headers.append('set-cookie', stringifySetCookie({ name, value, ...attributes }, { encode }));
			if (options.path.endsWith('.html'))
				headers.append(
					'set-cookie',
					stringifySetCookie(
						{ name, value, ...attributes, path: addDataSuffix(options.path) },
						{ encode }
					)
				);
		}
	}

	seal(): void {
		this.#sealed = true;
	}
}

function domainMatches(host: string, domain?: string): boolean {
	const constraint = domain?.replace(/^\./, '');
	return !constraint || host === constraint || host.endsWith(`.${constraint}`);
}

function pathMatches(path: string, constraint?: string): boolean {
	if (!constraint) return true;
	const root = constraint.replace(/\/$/, '');
	return path === root || path.startsWith(`${root}/`);
}
