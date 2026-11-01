import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { hmr: true },
	async test({ target, assert }) {
		await tick();
		assert.equal(target.querySelector('reloaded-panel').shadowRoot.querySelector('p').textContent, 'ready');
	}
});
