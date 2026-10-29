import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	test({ assert, target, warnings }) {
		const [btn1, btn2] = target.querySelectorAll('button');

		flushSync(() => {
			btn1.click();
		});

		assert.deepEqual(warnings.length, 0);

		flushSync(() => {
			btn2.click();
		});

		assert.deepEqual(warnings.length, 1);
	}
});
