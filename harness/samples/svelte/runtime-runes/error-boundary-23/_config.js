import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const btn = target.querySelector('button');
		btn?.click();
		await tick();

		assert.deepEqual(logs, ['attachment']);
	}
});
