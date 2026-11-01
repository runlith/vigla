import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ target, assert }) {
		await tick();
		assert.equal(target.textContent.trim(), '1/2/3');
	}
});
