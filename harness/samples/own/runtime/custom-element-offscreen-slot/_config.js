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
		target.querySelector('button').click();
		await flush();

		const host = target.querySelector('offscreen-host');
		const [fallback, named] = host.shadowRoot.querySelectorAll('slot');
		assert.deepEqual(
			named.assignedNodes().map((node) => node.textContent),
			['ready', 'held']
		);
		assert.equal(fallback.assignedNodes().length, 0);
	}
});
