import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual(logs, ['changed|changed|changed']);
		assert.equal(target.querySelector('p'), null);
	}
});
