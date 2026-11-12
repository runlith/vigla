import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, warnings }) {
		flushSync();
		assert.equal(document.body.querySelectorAll('p.portaled').length, 1);
		target.querySelector('button').click();
		flushSync();
		assert.equal(document.body.querySelectorAll('p.portaled').length, 0);
		assert.deepEqual(warnings, []);
	}
});
