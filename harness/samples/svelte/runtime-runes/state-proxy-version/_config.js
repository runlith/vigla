import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target }) {
		flushSync();
		assert.htmlEqual(target.innerHTML, `<div>Item</div>`);
	}
});
