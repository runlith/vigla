import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, raf, target }) {
		const button = target.querySelector('button');
		for (const time of [0, 300, 600]) {
			flushSync(() => button.click());
			raf.tick(time);
		}
		flushSync();
		assert.equal(target.querySelector('output').textContent, '0');
	}
});
