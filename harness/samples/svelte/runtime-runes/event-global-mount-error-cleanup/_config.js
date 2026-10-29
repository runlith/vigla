import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		target.click();
		flushSync();
		assert.deepEqual(logs, []);
	}
});
