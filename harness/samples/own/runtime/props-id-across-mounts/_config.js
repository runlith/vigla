import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		flushSync();
		assert.equal(target.querySelector('p').textContent, '3 of 3');
	}
});
