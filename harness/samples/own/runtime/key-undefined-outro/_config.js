import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, raf, target }) {
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual([...target.querySelectorAll('p')].map((node) => node.textContent), ['undefined', '1']);
		raf.tick(100);
		assert.deepEqual([...target.querySelectorAll('p')].map((node) => node.textContent), ['1']);
	}
});
