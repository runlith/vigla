import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ target }) {
		let button = target.querySelector('button');

		button?.click();

		flushSync();
	}
});
