import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target, logs }) {
		const [b1] = target.querySelectorAll('button');

		b1?.click();
		b1?.click();
		b1?.click();
		flushSync();
		assert.htmlEqual(target.innerHTML, '<button>4</button>');
	}
});
