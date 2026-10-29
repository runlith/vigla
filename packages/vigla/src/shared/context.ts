import { failure } from './diagnostics.ts';

export type Context<T> = [get: () => T, set: (value: T) => T, has: () => boolean];

export interface Contexts {
	getContext<T>(key: unknown): T;
	setContext<T>(key: unknown, value: T): T;
	hasContext(key: unknown): boolean;
}

export function keyed<T>(contexts: Contexts): Context<T> {
	const key = {};
	return [
		() => {
			if (!contexts.hasContext(key)) {
				throw failure(
					'missing_context',
					'Context was not set in the current component or any of its ancestors'
				);
			}
			return contexts.getContext<T>(key);
		},
		(value) => contexts.setContext(key, value),
		() => contexts.hasContext(key)
	];
}
