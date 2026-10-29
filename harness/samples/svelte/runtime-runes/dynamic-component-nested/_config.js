import { test } from '@vigla/harness/helpers';
import { flushSync } from 'svelte';

export default test({
	async test({ assert, target }) {
		assert.htmlEqual(target.innerHTML, 'test');
	}
});
