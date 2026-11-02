import { afterEach, expect, test, vi } from 'vitest';
import { getOwner, type Owner } from 'vigla';
import type { ClientApp } from '../types/internal/client.ts';
import { init, start } from './entry.ts';
import { goto } from '../entries/app/navigation/client.ts';
import { page } from '../entries/app/state/client.ts';

const environment = vi.hoisted(() => ({ dev: false }));
vi.mock('esm-env', () => ({
	get DEV() {
		return environment.dev;
	},
	BROWSER: true
}));

let owner: Owner;
afterEach(() => {
	owner?.dispose();
	vi.restoreAllMocks();
});

test.each([false, true])(
	'deprecated replacement preserves history and warns only once in dev (dev: %s)',
	async (dev) => {
		environment.dev = dev;
		const warnings: string[] = [];
		vi.spyOn(console, 'warn').mockImplementation((...values) => warnings.push(values.join(' ')));
		vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		document.body.innerHTML = '<main></main>';
		history.replaceState(null, '', '/entry');
		init({});
		const app: ClientApp = {
			global: '__navigation_test',
			nodes: [
				async () => ({ component: () => {} }),
				async () => ({ component: () => {} }),
				async () => ({ component: () => {} })
			],
			serverLoads: [],
			dictionary: { '/[id]': [2, []] },
			matchers: {},
			root: () => ({}),
			encoders: {},
			decoders: {},
			hooks: {
				init() {
					owner = getOwner()!;
				}
			}
		};
		await start(app, document.querySelector('main')!);
		await goto('/start', { replaceState: false });
		await goto('/finish', { replaceState: true });
		expect(page.url.pathname).toBe('/finish');
		history.back();
		await vi.waitFor(() => expect(page.url.pathname).toBe('/entry'));
		expect(
			warnings.filter((warning) => warning.includes('goto_replace_state_deprecated'))
		).toHaveLength(dev ? 1 : 0);
	}
);
