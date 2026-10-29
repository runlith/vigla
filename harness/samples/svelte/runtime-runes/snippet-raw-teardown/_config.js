import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ target, assert, logs }) {
		const button = target.querySelector('button');

		flushSync(() => button?.click());
		assert.deepEqual(logs, ['tearing down']);
	}
});
