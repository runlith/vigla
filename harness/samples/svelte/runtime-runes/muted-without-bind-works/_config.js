import { flushSync } from 'svelte';
import { ok, test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const btn = target.querySelector('button');
		ok(btn);
		flushSync(() => {
			btn.click();
		});
		assert.deepEqual(logs, [true]);
	}
});
