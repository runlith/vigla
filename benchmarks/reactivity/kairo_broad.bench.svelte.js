import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

export default createTest('kairo_broad', () => {
	let head = $state.raw(0);
	let last = {
		get v() {
			return head;
		}
	};
	let counter = 0;

	const destroy = $effect.root(() => {
		for (let i = 0; i < 50; i++) {
			const current = $derived(head + i);
			const current2 = $derived(current + 1);
			$effect.pre(() => {
				current2;
				counter++;
			});
			last = {
				get v() {
					return current2;
				}
			};
		}
	});

	return {
		destroy,
		run() {
			flushSync(() => {
				head = 1;
			});
			counter = 0;
			for (let i = 0; i < 50; i++) {
				flushSync(() => {
					head = i;
				});
				assert.equal(last.v, i + 50);
			}
			assert.equal(counter, 50 * 50);
		}
	};
});
