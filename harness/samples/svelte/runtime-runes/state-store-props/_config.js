import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		const btn = target.querySelector('button');

		flushSync(() => {
			btn?.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<pre>{\n"data": { "tags": { "first": 1, "second": 2, "third": 3 } } }</pre><button>add</button>`
		);
	}
});
