import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target }) {
		const btn = target.querySelector('button');

		assert.throws(() => {
			btn?.click();
			flushSync();
		}, /invalid_snippet/);
	}
});
