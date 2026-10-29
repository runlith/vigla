import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	async test({ assert, logs }) {
		await tick();

		assert.deepEqual(logs, ['ready', 'ready']);
	}
});
