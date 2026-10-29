import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		flushSync();

		assert.htmlEqual(target.innerHTML, '<p>error occurred</p>');
	}
});
