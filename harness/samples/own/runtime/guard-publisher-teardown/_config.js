import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		assert.equal(target.querySelector('p').textContent, 'twelve');
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelector('p'), null);
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelector('p').textContent, 'twelve');
	}
});
