import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],

	ssrHtml: `<p>item 1</p><p>item 2</p><p>item 3</p>`,
	html: `<p>item 1</p><p>item 2</p><p>item 3</p>`,

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, '<p>item 1</p><p>item 2</p><p>item 3</p>');
	}
});
