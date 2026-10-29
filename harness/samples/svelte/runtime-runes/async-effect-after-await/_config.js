import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, logs }) {
		assert.deepEqual(logs, []);
		await tick();
		assert.deepEqual(logs, ['before', 'after']);
	}
});
