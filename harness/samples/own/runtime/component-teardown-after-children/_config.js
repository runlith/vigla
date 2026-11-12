import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, logs }) {
		target.querySelector('button').click();
		flushSync();
		assert.deepEqual(logs, [
			'child onDestroy',
			'child module effect',
			'child effect',
			'parent module effect',
			'parent onDestroy',
			'parent effect'
		]);
	}
});
