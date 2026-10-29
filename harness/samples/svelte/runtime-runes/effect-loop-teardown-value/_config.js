import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target, logs }) {
		flushSync(() => target.querySelector('button')?.click());
		assert.deepEqual(logs, ['setup: two', 'cleanup: two']);
	}
});
