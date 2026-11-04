import { init, start } from '@vigla/kit/internal/client';
import { afterNavigate, goto } from '$app/navigation';
import { expect, test, vi } from 'vitest';
import { restorer } from './restore.ts';

test("a page's exported snapshot is captured when it is left and restored on return, warning once", async () => {
	let draft = 'first';
	const page = {
		snapshot: {
			capture: () => draft,
			restore: (value: string) => {
				draft = value;
			}
		}
	};
	const popped = Promise.withResolvers<void>();
	document.body.innerHTML = '<main></main>';
	history.replaceState(null, '', '/one');
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	init({ version: 'one' });
	await start(
		{
			global: '__facade_restore',
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
	draft = 'second';
	history.back();
	await popped.promise;
	document.body.replaceChildren();
	await Promise.resolve();
	expect(draft).toBe('first');
	expect(
		warn.mock.calls.filter(([message]) => String(message).includes('snapshot_export_deprecated'))
	).toEqual([
		[
			'%c[sveltekit] snapshot_export_deprecated\n%c`export const snapshot` is deprecated. Use the `snapshot` helper from `$app/navigation` instead.\nhttps://svelte.dev/e/kit/snapshot_export_deprecated',
			'font-weight: bold',
			'font-weight: normal'
		]
	]);
});
