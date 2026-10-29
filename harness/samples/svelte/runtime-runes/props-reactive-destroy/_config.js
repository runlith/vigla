import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, logs, target }) {
		target.querySelector('button')?.click();
		flushSync();
		assert.deepEqual(logs, ['should fire once']);
	}
});
