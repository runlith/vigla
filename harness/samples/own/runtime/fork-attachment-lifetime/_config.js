import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		await tick();
		const [stage, discard, hold, merge, resolve] = target.querySelectorAll('button');
		const node = target.querySelector('p');
		assert.equal(node.dataset.value, 'a');
		stage.click();
		await tick();
		assert.equal(node.dataset.value, 'a');
		discard.click();
		await tick();
		assert.equal(node.dataset.value, 'a');
		assert.deepEqual(logs, ['a']);
		hold.click();
		await tick();
		merge.click();
		await tick();
		assert.equal(node.dataset.value, 'a');
		resolve.click();
		await tick();
		assert.equal(node.dataset.value, 'c');
		assert.equal(node.textContent, '1');
		assert.deepEqual(logs, ['a', '-a', 'c']);
	}
});
