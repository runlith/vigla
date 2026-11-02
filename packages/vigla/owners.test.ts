import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cell, effect, root, tick, type Cell } from './src/entries/index.ts';
import { derived, get } from './src/entries/internal/client.ts';

test('a derived tracks a service-owned cell read after Owner.run returns', async () => {
	const service = root();
	const view = root();
	let state: Cell<number> | undefined;
	let shown: number | undefined;
	try {
		const value = view.run(() =>
			derived(() => {
				state ??= service.run(() => cell(0));
				return state.current;
			})
		);
		view.run(() =>
			effect(() => {
				shown = get(value);
			})
		);
		await tick();
		state!.current = 1;
		await tick();
		assert.equal(shown, 1);
	} finally {
		view.dispose();
		service.dispose();
	}
});
