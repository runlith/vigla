import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	skip_no_async: true,

	async test({ assert, target }) {
		await tick();

		assert.htmlEqual(
			target.innerHTML,
			`
				<p>baz: 69</p>
				<p></p>
			`
		);
	}
});
