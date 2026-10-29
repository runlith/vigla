import { ok, test } from '@vigla/harness/helpers';
import { flushSync } from 'svelte';

export default test({
	mode: ['client'],
	async test({ assert, logs }) {
		assert.equal(logs[0], logs[1]);
	}
});
