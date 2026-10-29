import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: `[{"a":0}] <button>[{"a":0}]</button>`,

	test({ assert, target }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();
		assert.htmlEqual(target.innerHTML, `[{"a":0}] <button>[{"a":0},{"a":1}]</button>`);
	}
});
