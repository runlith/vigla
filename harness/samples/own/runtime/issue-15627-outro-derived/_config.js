import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, raf, target }) {
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelectorAll('button').length, 2);
		const close = target.querySelector('button');
		flushSync(() => close.click());
		assert.equal(close.dataset.parameters, '123:2:1:id');
		raf.tick(400);
		assert.htmlEqual(target.innerHTML, '<button>Open</button>');
	}
});
