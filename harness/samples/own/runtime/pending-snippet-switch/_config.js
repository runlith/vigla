import { settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, instance, target }) {
		await new Promise(resolve => setTimeout(resolve, 0));
		try {
			target.querySelector('button').click();
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.deepEqual([...target.querySelectorAll('p')].map(node => node.textContent), ['DIV']);
		} finally {
			instance.release();
			await settled();
		}
		assert.equal(target.querySelector('h1').textContent, '1');
		assert.equal(target.querySelectorAll('p').length, 0);
	}
});
