import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelectorAll('button').length, 2);
		flushSync(() => target.querySelectorAll('button')[1].click());
		assert.equal(target.querySelectorAll('button').length, 1);
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelectorAll('button').length, 2);
	}
});
