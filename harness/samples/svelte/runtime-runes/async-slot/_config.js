import { tick } from 'svelte';
import { ok, test } from '@vigla/harness/helpers';

export default test({
	html: `
		<p>loading...</p>
	`,

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, '<p>hello</p>');
	}
});
