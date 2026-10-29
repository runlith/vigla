import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, logs, target }) {
		assert.deepEqual(logs, ['hello']);
	}
});
