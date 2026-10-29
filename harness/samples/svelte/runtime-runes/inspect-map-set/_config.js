import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';
import { normalise_inspect_logs } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, target, logs }) {
		const [btn, btn2] = target.querySelectorAll('button');
		btn.click();
		btn2.click();
		flushSync();

		assert.deepEqual(normalise_inspect_logs(logs), [
			new Map(),
			new Set(),
			new Map([['a', 'a']]),
			'at SvelteMap.set',
			new Set(['a']),
			'at SvelteSet.add'
		]);
	}
});
