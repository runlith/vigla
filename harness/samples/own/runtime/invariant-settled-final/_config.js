import { settled, tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

export default test({
	mode: ['client'],
	async test({ assert, target, logs }) {
		await flush();
		const [x, y, release] = target.querySelectorAll('button');
		x.click();
		await Promise.resolve();
		y.click();
		await Promise.resolve();
		const done = settled();
		release.click();
		await done;

		assert.equal(logs.at(-1), '1 1 2');
		assert.equal(target.querySelector('p').textContent, '1');
		assert.equal(target.querySelector('b').textContent, '1');
	}
});
