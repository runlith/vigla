import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

const size = 30;

export default createTest('kairo_repeated', () => {
	let head = $state.raw(0);
	const current = $derived.by(() => {
		let result = 0;
		for (let i = 0; i < size; i++) {
			result += head;
		}
		return result;
	});
	let counter = 0;

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			current;
			counter++;
		});
	});

	return {
		destroy,
		run() {
			flushSync(() => {
				head = 1;
			});
			assert.equal(current, size);
			counter = 0;
			for (let i = 0; i < 100; i++) {
				flushSync(() => {
					head = i;
				});
				assert.equal(current, i * size);
			}
			assert.equal(counter, 100);
		}
	};
});
