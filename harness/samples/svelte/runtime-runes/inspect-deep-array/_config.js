import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';
import { normalise_inspect_logs } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ target, assert, logs }) {
		const button = target.querySelector('button');

		flushSync(() => {
			button?.click();
		});

		assert.deepEqual(normalise_inspect_logs(logs), [[1, 2, 3, 7], [2, 3, 7], 'at Object.doSplice']);
	}
});
