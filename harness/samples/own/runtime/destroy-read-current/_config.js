import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, raf, target, logs }) {
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual(logs, ['changed|changed|changed']);
		assert.equal(target.querySelector('p').textContent, 'initial');
		raf.tick(100);
		assert.deepEqual(logs, ['changed|changed|changed', 'destroy:finished/finished', 'cleanup:changed', 'active:initial']);
		assert.equal(target.querySelector('p'), null);
	}
});
