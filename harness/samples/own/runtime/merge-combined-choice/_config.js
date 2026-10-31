import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		await tick();
		const [hold, overwrite, resolve] = target.querySelectorAll('button');
		hold.click();
		await tick();
		overwrite.click();
		await tick();
		resolve.click();
		await tick();
		assert.equal(target.querySelector('span')?.textContent, '2');
		assert.deepEqual([...target.querySelectorAll('i')].map((node) => node.textContent), ['2']);
	}
});
