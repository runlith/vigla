import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	ssrHtml: 'works',
	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, 'works');
	}
});
