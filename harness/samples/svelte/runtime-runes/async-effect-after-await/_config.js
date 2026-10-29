import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, logs }) {
		assert.deepEqual(logs, []);
		await tick();
		assert.deepEqual(logs, ['before', 'after']);
	}
});
