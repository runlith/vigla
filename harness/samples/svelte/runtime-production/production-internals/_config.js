import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ target }) {
		let button = target.querySelector('button');

		button?.click();

		flushSync();
	}
});
