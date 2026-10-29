import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

export default createTest('clean_effects', () => {
	const a = $state.raw(1);
	let b = $state.raw(2);
	let total = 0;

	const destroy = $effect.root(() => {
		for (let i = 0; i < 1000; i += 1) {
			$effect.pre(() => {
				total += a;
			});
		}
		$effect.pre(() => {
			total += b;
		});
	});

	return {
		destroy,
		run() {
			for (let i = 0; i < 5; i++) {
				total = 0;
				flushSync(() => {
					b = i;
				});
				assert.equal(total, i);
			}
		}
	};
});
