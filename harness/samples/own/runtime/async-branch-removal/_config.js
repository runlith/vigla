import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		await flush();
		const [remove, update, release] = target.querySelectorAll('button');
		remove.click();
		await flush();
		update.click();
		await flush();
		release.click();
		await flush();

		assert.deepEqual(logs, []);
		assert.equal(target.querySelector('b'), null);
	}
});
