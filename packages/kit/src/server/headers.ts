import * as errors from './errors.ts';
import * as warnings from './warnings.ts';

const directives = new Set([
	'max-age',
	'public',
	'private',
	'no-cache',
	'no-store',
	'must-revalidate',
	'proxy-revalidate',
	's-maxage',
	'immutable',
	'stale-while-revalidate',
	'stale-if-error',
	'no-transform',
	'only-if-cached',
	'max-stale',
	'min-fresh'
]);

export function validateHeaders(headers: Record<string, string>): void {
	for (const [name, value] of Object.entries(headers)) {
		if (name.toLowerCase() === 'cache-control') {
			const parts = value.split(',').map((part) => part.trim());
			if (parts.some((part) => !part)) warnings.cache_control_empty_directive({ value });
			else {
				const invalid = parts
					.map((part) => part.split('=')[0]!.toLowerCase())
					.find((part) => !directives.has(part));
				if (invalid)
					warnings.cache_control_invalid_directive({
						directive: invalid,
						directives: [...directives].join(', '),
						value
					});
			}
		} else if (name.toLowerCase() === 'content-type') {
			const type = value.split(';')[0]!.trim();
			if (
				!/^(application|audio|example|font|haptics|image|message|model|multipart|text|video|x-[a-z]+)\/[-+.\w]+$/i.test(
					type
				)
			)
				warnings.content_type_invalid({ type, value });
		}
	}
}

export class ResponseHeaders {
	readonly values = new Headers();
	#sealed = false;
	readonly #dev: boolean;

	constructor(dev: boolean) {
		this.#dev = dev;
	}

	set = (headers: Record<string, string>): void => {
		if (this.#sealed) errors.set_headers_after_response();
		if (this.#dev) validateHeaders(headers);
		for (const [key, value] of Object.entries(headers)) {
			const name = key.toLowerCase();
			if (name === 'set-cookie') errors.set_headers_cookie();
			if (name === 'server-timing') this.values.append(name, value);
			else {
				if (this.values.has(name)) errors.header_already_set({ name: key });
				this.values.set(name, value);
			}
		}
	};

	seal(): void {
		this.#sealed = true;
	}
}
