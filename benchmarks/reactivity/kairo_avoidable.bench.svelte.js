import assert from 'node:assert';
import { flushSync } from 'svelte';
import { busy, createTest } from './util.svelte.js';

export default createTest('kairo_avoidable', () => {
	let head = $state.raw(0);
	const computed1 = $derived(head);
	const computed2 = $derived((computed1, 0));
	const computed3 = $derived((busy(), computed2 + 1));
	const computed4 = $derived(computed3 + 2);
	const computed5 = $derived(computed4 + 3);

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			computed5;
			busy();
		});
	});

	return {
		destroy,
		run() {
			flushSync(() => {
				head = 1;
			});
			assert.equal(computed5, 6);
			for (let i = 0; i < 1000; i++) {
				flushSync(() => {
					head = i;
				});
				assert.equal(computed5, 6);
			}
		}
	};
});
