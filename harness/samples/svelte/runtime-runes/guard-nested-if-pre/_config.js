import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		const button = target.querySelector('button');

		button?.click();
		flushSync();
		assert.deepEqual(logs, ['pre', 'running b', 'pre', 'pre']);
	}
});
