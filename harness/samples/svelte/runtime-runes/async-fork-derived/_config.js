import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const [increment] = target.querySelectorAll('button');

		increment.click();
		await tick();
		assert.deepEqual(logs, [1, 2]);

		increment.click();
		await tick();
		assert.deepEqual(logs, [1, 2, 2, 3]);
	}
});
