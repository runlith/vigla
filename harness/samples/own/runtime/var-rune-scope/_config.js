import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	html: '<button>update</button><p>2/4|7/14</p>',
	test({ assert, logs, target }) {
		assert.deepEqual(logs, [undefined, undefined, undefined, undefined]);
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelector('p').textContent, '3/6|7/14');
	}
});
