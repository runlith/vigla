import { settled, tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		await new Promise(resolve => setTimeout(resolve, 0));
		const [increment, resolve] = target.querySelectorAll('button');
		increment.click();
		await tick();
		increment.click();
		await tick();
		assert.equal(target.querySelector('p').textContent, '1/1');
		resolve.click();
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.equal(target.querySelector('p').textContent, '2/2');
		resolve.click();
		await settled();
		assert.equal(target.querySelector('p').textContent, '3/3');
	}
});
