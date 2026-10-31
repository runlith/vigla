import type { RequestState } from '../types/internal/server.ts';
import { url_search_unavailable_prerender } from './errors.ts';

export function restrictSearch(url: URL, state: RequestState): void {
	const forbidden = (): boolean =>
		!state.prerendering?.insideReroute &&
		!state.prerendering?.fallback &&
		(!!state.prerendering || state.prerenderDefault === true);
	for (const property of ['search', 'searchParams'] as const) {
		const descriptor =
			Object.getOwnPropertyDescriptor(url, property) ??
			Object.getOwnPropertyDescriptor(URL.prototype, property)!;
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
