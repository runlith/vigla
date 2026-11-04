import { init, start } from '@vigla/kit/internal/client';
import { restorer } from '@vigla/kit/internal/restore';
import { afterNavigate, goto } from '$app/navigation';
import { expect, test, vi } from 'vitest';

test("under Kit's own identity a page's exported snapshot is never read", async () => {
	let reads = 0;
	const page = {
		get snapshot() {
			reads++;
			return { capture: () => 'value', restore: () => {} };
		}
	};
	const popped = Promise.withResolvers<void>();
	document.body.innerHTML = '<main></main>';
	history.replaceState(null, '', '/one');
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	init({ version: 'one' });
	await start(
		{
			global: '__facade_own',
			nodes: [1, 2, 3].map(() => async () => ({ component: () => {} })),
			serverLoads: [],
			dictionary: { '/one': [2, []], '/two': [2, []] },
			matchers: {},
			root: (_anchor, props) => {
				props.components[0] = page;
				return {};
			},
			restorer,
			encoders: {},
			decoders: {},
			hooks: {
				init: () =>
					afterNavigate((navigation) => {
						if (navigation.type === 'popstate') popped.resolve();
					})
			}
		},
		document.querySelector('main')!
	);
	await goto('/two');
	history.back();
	await popped.promise;
	window.dispatchEvent(new Event('pagehide'));
	document.body.replaceChildren();
	await Promise.resolve();
	expect(reads).toBe(0);
});
