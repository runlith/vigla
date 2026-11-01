import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		logs.length = 0;
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual(logs, ['INPUT']);
		assert.equal(target.querySelector('input'), null);
	}
});
