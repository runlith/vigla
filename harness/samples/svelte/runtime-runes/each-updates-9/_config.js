import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const [btn1] = target.querySelectorAll('button');

		btn1.click();
		flushSync();

		await Promise.resolve();
		await Promise.resolve();

		assert.deepEqual(logs, ['cleanup']);
	}
});
