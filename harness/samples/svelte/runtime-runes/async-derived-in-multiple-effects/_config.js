import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const button = target.querySelector('button');

		button?.click();
		await tick();
		assert.deepEqual(logs, [5]);

		button?.click();
		await tick();
		assert.deepEqual(logs, [5, 7]);
	}
});
