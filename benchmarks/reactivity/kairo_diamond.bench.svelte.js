import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

const width = 5;

export default createTest('kairo_diamond', () => {
	let head = $state.raw(0);
	const current = [];
	for (let i = 0; i < width; i++) {
		const next = $derived(head + 1);
		current.push({
			get v() {
				return next;
			}
		});
	}
	const sum = $derived(current.map((x) => x.v).reduce((a, b) => a + b, 0));
	let counter = 0;

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			sum;
			counter++;
		});
	});

	return {
		destroy,
		run() {
			flushSync(() => {
				head = 1;
			});
			assert.equal(sum, 2 * width);
			counter = 0;
			for (let i = 0; i < 500; i++) {
				flushSync(() => {
					head = i;
				});
				assert.equal(sum, (i + 1) * width);
			}
			assert.equal(counter, 500);
		}
	};
});
