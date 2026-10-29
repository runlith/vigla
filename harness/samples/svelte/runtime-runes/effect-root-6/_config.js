import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

// Test that $effect.root continues to be operational after its parent effect has been destroyed
export default test({
	test({ assert, target, logs }) {
		const [hide, increment] = target.querySelectorAll('button');

		hide.click();
		flushSync();
		increment.click();
		assert.deepEqual(logs, ['count', 1, 'double', 2]);
	}
});
