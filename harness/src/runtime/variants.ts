import type { Config, Variant } from './config.ts';

export const variants: readonly Variant[] = ['dom', 'hydrate', 'ssr', 'async-ssr'];

export type Presence = 'absent' | 'skipped' | 'run';

function rendersOnServer(config: Config): boolean {
	return (
		config.test_ssr !== undefined ||
		config.html !== undefined ||
		config.ssrHtml !== undefined ||
		config.error !== undefined ||
		config.runtime_error !== undefined
	);
}

export function presence(variant: Variant, config: Config, name: string): Presence {
	if (config.skip_async) return 'absent';
	const { mode, skip_mode } = config;

	switch (variant) {
		case 'dom':
			if (skip_mode?.includes('client') || (mode && !mode.includes('client'))) return 'absent';
			return 'run';
		case 'hydrate':
			if (mode && !mode.includes('hydrate')) return 'absent';
			return skip_mode?.includes('hydrate') ? 'skipped' : 'run';
		case 'ssr':
			if (
				(name.startsWith('async-') && !mode?.includes('server')) ||
				(mode && !mode.includes('server')) ||
				(!rendersOnServer(config) && !mode?.includes('server'))
			) {
				return 'absent';
			}
			return skip_mode?.includes('server') ? 'skipped' : 'run';
		case 'async-ssr':
			if (
				(mode && !mode.includes('async-server')) ||
				(!rendersOnServer(config) && !mode?.includes('async-server'))
			) {
				return 'absent';
			}
			return skip_mode?.includes('async-server') ? 'skipped' : 'run';
	}
}
