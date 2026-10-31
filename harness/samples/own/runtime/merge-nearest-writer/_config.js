import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		await tick();
		const [first, second, overwrite, resolveFirst, resolveSecond] = target.querySelectorAll('button');
		first.click();
		await tick();
		second.click();
		await tick();
		overwrite.click();
		await tick();
		resolveFirst.click();
		await tick();
		assert.equal(target.querySelector('p').textContent, '1');
		resolveSecond.click();
		await tick();
		assert.equal(target.querySelector('p').textContent, '3');
	}
});
