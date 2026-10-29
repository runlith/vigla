import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		const [b1, b2] = target.querySelectorAll('button');

		b1.click();
		flushSync();
		assert.deepEqual(logs, ['works']);

		b2.click();
		flushSync();
		assert.deepEqual(logs, ['works', 'works']);
	}
});
