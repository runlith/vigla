import { settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: false },
	async test({ assert, target }) {
		await new Promise(resolve => setTimeout(resolve, 0));
		target.querySelector('button').click();
		await settled();
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.deepEqual([target.querySelector('p').textContent, target.querySelector('output').textContent], ['1', '1']);
	}
});
