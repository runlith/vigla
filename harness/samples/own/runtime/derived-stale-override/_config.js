import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, instance, target }) {
		const detached = instance.disconnected();
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual([target.querySelector('p').textContent, detached], ['1', 1]);
	}
});
