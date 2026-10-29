import type { CompileOptions } from 'svelte/compiler';

export function forced(own: Partial<CompileOptions> | undefined): Partial<CompileOptions> {
	return {
		experimental: { async: true },
		...own,
		runes: own && 'runes' in own ? own.runes : true
	};
}
