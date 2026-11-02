import type { RequestState } from '../types/internal/server.ts';
import { url_search_unavailable_prerender } from './errors.ts';

function descriptorOf(url: URL, property: string): PropertyDescriptor {
	for (let object: object | null = url; object; object = Object.getPrototypeOf(object)) {
		const descriptor = Object.getOwnPropertyDescriptor(object, property);
		if (descriptor) return descriptor;
	}
	throw new TypeError(`URL has no ${property} property`);
}

export function restrictSearch(url: URL, state: RequestState, staticLoad = false): void {
	const forbidden = (): boolean =>
		!state.prerendering?.insideReroute &&
		!state.prerendering?.fallback &&
		(!!state.prerendering || (staticLoad && state.prerenderDefault === true));
	for (const property of ['search', 'searchParams'] as const) {
		const descriptor = descriptorOf(url, property);
		Object.defineProperty(url, property, {
			configurable: true,
			enumerable: descriptor.enumerable,
			get() {
				if (forbidden()) url_search_unavailable_prerender({ property });
				return 'value' in descriptor ? descriptor.value : descriptor.get!.call(url);
			},
			set: descriptor.set
				? (value) => {
						if (forbidden()) url_search_unavailable_prerender({ property });
						descriptor.set!.call(url, value);
					}
				: undefined
		});
	}
}
