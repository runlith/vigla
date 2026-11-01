import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ target, assert }) {
		await tick();
		const host = target.querySelector('snippet-panel');
		const slot = host.shadowRoot.querySelector('slot');
		assert.equal(slot?.assignedNodes()[0]?.textContent, 'light');
	}
});
