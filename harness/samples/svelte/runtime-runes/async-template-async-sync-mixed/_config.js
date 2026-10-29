import { tick } from 'svelte';
import { ok, test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, '<p>foo bar</p>');
	}
});
