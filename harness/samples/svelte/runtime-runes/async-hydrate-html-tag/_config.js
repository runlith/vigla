import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],
	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, `<div><div><p>first test</p></div> other test</div>`);
	}
});
