import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

async function flush() {
	for (let i = 0; i < 6; i += 1) await tick();
	await Promise.resolve();
}

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		await flush();
		const [a, b, c, release] = target.querySelectorAll('button');
		a.click();
		await flush();
		b.click();
		await flush();
		c.click();
		await flush();
		release.click();
		await flush();

		assert.deepEqual(
			[...target.querySelectorAll('p')].map((node) => node.textContent),
			['item 1']
		);
		assert.equal(target.querySelector('b').textContent, '1');
	}
});
