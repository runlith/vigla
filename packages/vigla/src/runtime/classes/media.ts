import { Subscribed } from './subscriber.ts';

const parenthesized = /\(.+\)/;

const bare = new Set(['all', 'print', 'screen', 'and', 'or', 'not', 'only']);

export function normalize(query: string): string {
	if (parenthesized.test(query)) return query;
	for (const word of query.split(/[\s,]+/)) if (bare.has(word.trim())) return query;
	return `(${query})`;
}

export class MediaQuery extends Subscribed<boolean> {
	constructor(query: string, fallback?: boolean) {
		void fallback;
		const list = window.matchMedia(normalize(query));
		super(
			() => list.matches,
			(update) => {
				list.addEventListener('change', update);
				return () => list.removeEventListener('change', update);
			}
		);
	}
}
