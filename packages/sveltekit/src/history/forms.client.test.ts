import { init, start, type ClientApp } from '@vigla/kit/internal/client';
import { page } from '$app/state';
import { expect, test, vi } from 'vitest';
import { enhance } from './app/forms.ts';

interface Submission {
	update(options?: { invalidateAll?: boolean }): Promise<void>;
}

test("enhance converts update's invalidateAll from a callback a non-native thenable resolves", async () => {
	let loads = 0;
	const app: ClientApp = {
		global: '__facade_forms',
		nodes: [
			async () => ({ component: () => {} }),
			async () => ({ component: () => {} }),
			async () => ({ component: () => {}, universal: { load: () => ({ value: ++loads }) } })
		],
		serverLoads: [],
		dictionary: { '/one': [2, []] },
		matchers: {},
		root: () => ({}),
		encoders: {},
		decoders: {},
		hooks: {}
	};
	document.body.innerHTML = '<main></main>';
	history.replaceState(null, '', '/one');
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	init({ version: 'one' });
	await start(app, document.querySelector('main')!);
	expect(loads).toBe(1);

	const form = document.createElement('form');
	form.method = 'post';
	form.innerHTML = '<button>save</button>';
	document.body.append(form);
	vi.stubGlobal(
		'fetch',
		async () =>
			new Response(
				JSON.stringify({ type: 'success', status: 200, data: JSON.stringify([{ saved: 1 }, true]) })
			)
	);
	const callback = ({ update }: Submission) => update({ invalidateAll: false });
	const enhancement = enhance(form, (() => ({
		then: (resolve: (value: typeof callback) => void) => resolve(callback)
	})) as never);
	form.dispatchEvent(
		new SubmitEvent('submit', {
			bubbles: true,
			cancelable: true,
			submitter: form.querySelector('button')!
		})
	);
	await vi.waitFor(() => expect(page.form).toEqual({ saved: true }));
	expect(loads).toBe(1);
	enhancement.destroy();
	document.body.replaceChildren();
	await Promise.resolve();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
