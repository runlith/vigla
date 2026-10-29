import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	skip_mode: ['server'],
	skip_no_async: true,

	ssrHtml: `<div>1</div><p>after</p>`,

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, '<div>1</div><p>after</p>');
	}
});
