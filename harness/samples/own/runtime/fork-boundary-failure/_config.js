import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		await tick();
		const [stage, discard, fail] = target.querySelectorAll('button');
		assert.equal(target.querySelector('p').textContent, 'ready');

		stage.click();
		await tick();
		assert.equal(target.querySelector('p').textContent, 'ready');
		assert.deepEqual(logs, []);

		discard.click();
		await tick();
		assert.equal(target.querySelector('p').textContent, 'ready');
		assert.deepEqual(logs, []);

		fail.click();
		await tick();
		assert.equal(target.querySelector('p').textContent, 'boom');
		assert.deepEqual(logs, ['boom']);
	}
});
