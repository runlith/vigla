import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	compileOptions: { dev: false },
	test({ assert, target, warnings }) {
		flushSync(() => target.querySelector('button').click());
		assert.equal(target.querySelector('p').textContent, '[[],false,-1,-1]');
		assert.deepEqual(warnings, []);
	}
});
