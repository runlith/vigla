import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, logs, target }) {
		assert.deepEqual(logs, ['hello']);
	}
});
