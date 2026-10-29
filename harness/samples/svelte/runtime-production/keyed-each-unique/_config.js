import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target }) {
		let button = target.querySelector('button');

		button?.click();

		assert.throws(flushSync, 'https://svelte.dev/e/each_key_duplicate');
	}
});
