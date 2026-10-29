import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	skip_mode: ['server'],

	ssrHtml: '<p>hello</p>',

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, '<p>hello</p>');
	}
});
