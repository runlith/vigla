import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();

		assert.deepEqual(logs, ['worked']);
	}
});
