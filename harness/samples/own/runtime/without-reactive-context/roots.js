import { without_reactive_context } from 'svelte/internal/client';

export const roots = { live: 0 };

export function detach(fn) {
	return without_reactive_context(fn);
}
