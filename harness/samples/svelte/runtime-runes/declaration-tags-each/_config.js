import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ target, assert }) {
		const [btn1, btn2] = target.querySelectorAll('button');
		flushSync(() => btn2.click());
		assert.equal(btn1.textContent, '1');
	}
});
