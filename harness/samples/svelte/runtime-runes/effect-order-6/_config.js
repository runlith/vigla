import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const [open, close] = target.querySelectorAll('button');

		flushSync(() => open.click());
		flushSync(() => close.click());

		assert.deepEqual(logs, [{ boolean: true, closed: false }]);
	}
});
