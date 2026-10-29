import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server', 'client', 'hydrate'],
	ssrHtml: 'value <div class="value"></div>',
	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, 'value <div class="value"></div>');
	}
});
