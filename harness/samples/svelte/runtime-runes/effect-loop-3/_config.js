import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [button] = target.querySelectorAll('button');

		assert.doesNotThrow(() => {
			flushSync(() => button.click());
		});
	}
});
