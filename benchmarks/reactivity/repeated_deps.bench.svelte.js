import assert from 'node:assert';
import { flushSync } from 'svelte';
import { cell, createTest } from './util.svelte.js';

const ARRAY_SIZE = 1000;

export default createTest('repeated_deps', () => {
	const signals = Array.from({ length: ARRAY_SIZE }, (_, i) => cell(i));
	let order = $state.raw(0);

	const total = $derived.by(() => {
		const ord = order;
		let sum = 0;
		for (let i = 0; i < ARRAY_SIZE; i++) {
			sum += signals[(i + ord) % ARRAY_SIZE].v;
		}
		return sum;
	});

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			total;
		});
	});

	return {
		destroy,
		run() {
			for (let i = 0; i < 5; i++) {
				flushSync(() => {
					order = i;
				});
				assert.equal(total, (ARRAY_SIZE * (ARRAY_SIZE - 1)) / 2);
			}
		}
	};
});
