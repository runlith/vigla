import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';
import { roots } from './roots.js';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		const button = target.querySelector('button');
		flushSync(() => button.click());
		flushSync(() => button.click());
		assert.equal(roots.live, 3);
	}
});
