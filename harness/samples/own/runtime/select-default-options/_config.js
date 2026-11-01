import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	async test({ assert, target }) {
		const select = target.querySelector('select');
		assert.equal(select.value, 'b');
		assert.deepEqual([...select.options].map((option) => option.defaultSelected), [false, true]);
		flushSync(() => target.querySelector('button').click());
		await Promise.resolve();
		assert.equal(select.value, 'b');
		assert.deepEqual([...select.options].map((option) => option.defaultSelected), [true, false]);
	}
});
