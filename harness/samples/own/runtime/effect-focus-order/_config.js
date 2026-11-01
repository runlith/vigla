import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		flushSync(() => target.querySelector('button').click());
		target.querySelector('input').focus();
		logs.length = 0;
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual(logs, ['pre:false', 'post:false']);
		assert.equal(target.querySelector('input'), null);
	}
});
