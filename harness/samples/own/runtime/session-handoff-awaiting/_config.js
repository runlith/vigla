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
		const [login, answer, chunk] = target.querySelectorAll('button');
		const shown = () => target.querySelector('div')?.textContent;
		assert.equal(shown(), 'ready');
		login.click();
		await flush();
		answer.click();
		await flush();
		chunk.click();
		await flush();
		assert.equal(shown(), 'ready');
	}
});
