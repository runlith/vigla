import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

export default createTest('kairo_unstable', () => {
	let head = $state.raw(0);
	const double = $derived(head * 2);
	const inverse = $derived(-head);
	const current = $derived.by(() => {
		let result = 0;
		for (let i = 0; i < 20; i++) {
			result += head % 2 ? double : inverse;
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
			assert.equal(current, 40);
			counter = 0;
			for (let i = 0; i < 100; i++) {
				flushSync(() => {
					head = i;
				});
			}
			assert.equal(counter, 100);
		}
	};
});
