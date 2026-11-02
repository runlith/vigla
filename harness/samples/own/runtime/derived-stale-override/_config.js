import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, instance, target }) {
		const detached = instance.disconnected();
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual([target.querySelector('p').textContent, detached], ['1', 1]);
		assert.deepEqual(await instance.forkOverrides(), [1, 1, 1, 3, 3, 5]);
		assert.deepEqual(instance.forkView(), [[3, 1], 1]);
	}
});
