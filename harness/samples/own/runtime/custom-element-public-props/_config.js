import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ target, assert }) {
		await tick();
		for (const host of target.children) {
			const root = host.shadowRoot;
			assert.equal(root.querySelector('b')?.parentNode, root);
		}
	}
});
