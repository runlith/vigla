import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		let [btn1] = target.querySelectorAll('button');

		flushSync(() => {
			btn1.click();
		});

		assert.deepEqual(logs, ['computing', 'a', 'a', 'computing', 'bb', 'bb']);
	}
});
