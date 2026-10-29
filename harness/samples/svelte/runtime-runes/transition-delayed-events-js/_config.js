import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, raf, target, logs }) {
		const [btn] = target.querySelectorAll('button');

		// in
		flushSync(() => btn.click());
		assert.deepEqual(logs, []);
		raf.tick(1);
		assert.deepEqual(logs, []);

		raf.tick(100);
		assert.deepEqual(logs, ['introstart']);

		raf.tick(200);
		assert.deepEqual(logs, ['introstart', 'introend']);

		// out
		flushSync(() => btn.click());
		assert.deepEqual(logs, ['introstart', 'introend']);
		raf.tick(201);
		assert.deepEqual(logs, ['introstart', 'introend']);

		raf.tick(300);
		assert.deepEqual(logs, ['introstart', 'introend', 'outrostart']);

		raf.tick(400);
		assert.deepEqual(logs, ['introstart', 'introend', 'outrostart', 'outroend']);
	}
});
