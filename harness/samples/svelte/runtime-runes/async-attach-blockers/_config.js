import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	async test({ assert, logs }) {
		await tick();

		assert.deepEqual(logs, ['ready', 'ready']);
	}
});
