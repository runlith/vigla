import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		target.click();
		flushSync();
		assert.deepEqual(logs, []);
	}
});
