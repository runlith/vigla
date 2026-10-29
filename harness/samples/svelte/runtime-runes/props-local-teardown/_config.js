import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, logs, target }) {
		const [btn1] = target.querySelectorAll('button');

		btn1?.click();
		flushSync();

		btn1?.click();
		flushSync();

		btn1?.click();
		flushSync();

		assert.deepEqual(logs, ['init', 'teardown', 'init', 'teardown']);
	}
});
