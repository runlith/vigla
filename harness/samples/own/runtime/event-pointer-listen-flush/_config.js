import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		target.querySelector('#show').click();
		flushSync();
		const hot = target.querySelector('#hot');
		hot.dispatchEvent(new Event('pointerenter'));
		flushSync();
		assert.equal(hot.textContent, 'true');
	}
});
