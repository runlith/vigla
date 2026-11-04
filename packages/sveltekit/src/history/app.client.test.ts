import { init, start, type ClientApp } from '@vigla/kit/internal/client';
import { page } from '$app/state';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { enhance } from './app/forms.ts';
import { goto } from './app/navigation.ts';

interface Submission {
	update(options?: { invalidateAll?: boolean }): Promise<void>;
}

let loads = 0;

beforeAll(async () => {
	const app: ClientApp = {
		global: '__facade_app',
		nodes: [
			async () => ({ component: () => {} }),
			async () => ({ component: () => {} }),
			async () => ({ component: () => {}, universal: { load: () => ({ value: ++loads }) } })
		],
		serverLoads: [],
		dictionary: { '/one': [2, []], '/two': [2, []] },
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
});

afterAll(async () => {
	document.body.replaceChildren();
	await Promise.resolve();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test("enhance converts update's invalidateAll from a callback a non-native thenable resolves", async () => {
	const before = loads;
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
	expect(loads).toBe(before);
	enhancement.destroy();
	form.remove();
});

test("goto's invalidateAll warning is left for the first non-shallow navigation to a valid destination", async () => {
	const warnings = () =>
		vi
			.mocked(console.warn)
			.mock.calls.filter(([message]) => String(message).includes('goto_invalidate_all_deprecated'))
			.length;
	await goto('/one', { shallow: true, invalidateAll: false });
	await expect(goto('https://elsewhere.test/', { invalidateAll: false })).rejects.toThrow();
	expect(warnings()).toBe(0);
	await goto('/two', { invalidateAll: false });
	await goto('/one', { invalidateAll: false });
	expect(warnings()).toBe(1);
});
