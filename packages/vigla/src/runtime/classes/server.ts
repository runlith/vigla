import type { Start } from './subscriber.ts';

export class MediaQuery {
	readonly current: boolean;

	constructor(query: string, fallback = false) {
		void query;
		this.current = fallback;
	}
}

export const prefersReducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

export function createSubscriber(start: Start): () => void {
	void start;
	return () => {};
}
