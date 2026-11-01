import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, raf, target }) {
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelectorAll('button').length, 2);
		flushSync(() => target.querySelector('button').click());
		raf.tick(400);
		assert.htmlEqual(target.innerHTML, '<button>Open</button>');
	}
});
