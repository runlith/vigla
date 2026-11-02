import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, raf, logs }) {
		const toggle = () => flushSync(() => target.querySelector('button').click());
		toggle();
		const span = target.querySelector('span');
		raf.tick(50);
		assert.equal(span.foo, 0.5);
		toggle();
		assert.equal(span.foo, 0.5);
		raf.tick(75);
		assert.equal(span.foo, 0.75);
		assert.equal(span.bar, 0.75);
		toggle();
		raf.tick(100);
		assert.equal(span.foo, 0.25);
		assert.equal(span.bar, 1);
		assert.deepEqual(logs, ['in', 'out', 'in']);
	}
});
