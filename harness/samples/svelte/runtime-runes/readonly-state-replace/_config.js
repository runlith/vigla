import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target }) {
		const [b1] = target.querySelectorAll('button');
		b1.click();
		flushSync();

		assert.htmlEqual(target.innerHTML, `<button>0, 1</button>`);
	}
});
