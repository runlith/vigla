import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		const [close, bump] = target.querySelectorAll('button');
		assert.deepEqual(logs, ['count 0', 'other 0']);
		flushSync(() => close.click());
		flushSync(() => bump.click());
		assert.deepEqual(logs, ['count 0', 'other 0', 'count 1', 'other 1']);
	}
});
