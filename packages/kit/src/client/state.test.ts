// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cell, effect, root, settled } from 'vigla';
import { State } from './state.ts';
import type { ClientApp } from '../types/internal/client.ts';

vi.mock('esm-env', () => ({ DEV: false, BROWSER: true }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test('version polling coalesces slow checks and stays scheduled after they finish', async () => {
	vi.useFakeTimers();
	let resolve!: (response: Response) => void;
	const fetcher = vi.fn(
		() =>
			new Promise<Response>((done) => {
				resolve = done;
			})
	);
	vi.stubGlobal('fetch', fetcher);
	const state = new State({ version: 'one', version_poll_interval: 10 });
	const first = state.check();
	const second = state.check();
	expect(first).toBe(second);
	await vi.advanceTimersByTimeAsync(20);
	resolve(new Response('{"version":"one"}'));
	expect(await first).toBe(false);
	await vi.advanceTimersByTimeAsync(10);
	resolve(new Response('{"version":"two"}'));
	await vi.advanceTimersByTimeAsync(0);
	expect(state.updated.current).toBe(true);
	state.dispose();
});

test('explicit version checks remain available with response-header observation disabled', async () => {
	const app: ClientApp = {
		global: '',
		nodes: [],
		serverLoads: [],
		dictionary: {},
		matchers: {},
		hooks: {},
		root: () => {},
		encoders: {},
		decoders: {},
		versionChecks: false
	};
	const state = new State({ version: 'one' }, app);
	state.notify('two');
	expect(state.updated.current).toBe(false);
	vi.stubGlobal('fetch', async () => new Response('{"version":"two"}'));
	expect(await state.updated.check()).toBe(true);
	expect(state.updated.current).toBe(true);
	state.dispose();
});

test('page and passive version updates are cells usable from application reactions', async () => {
	const state = new State({ version: 'one' });
	const observed: unknown[] = [];
	const trigger = cell(false);
	const owner = root(() => {
		effect(() => {
			observed.push(state.page.data);
		});
		effect(() => {
			if (trigger.current) state.notify('two');
		});
	});
	await settled();
	state.update({ data: { value: 2 } });
	trigger.current = true;
	await settled();
	expect(observed).toEqual([{}, { value: 2 }]);
	expect(state.updated.current).toBe(true);
	state.notify(null);
	expect(state.updated.current).toBe(true);
	owner.dispose();
	state.dispose();
});
