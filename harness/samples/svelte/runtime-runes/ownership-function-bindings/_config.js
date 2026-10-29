import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},
	test({ target, warnings, assert }) {
		const btn = target.querySelector('button');
		flushSync(() => {
			btn?.click();
		});
		assert.deepEqual(warnings, []);

		flushSync(() => {
			btn?.click();
		});
		assert.deepEqual(warnings, []);
	}
});
