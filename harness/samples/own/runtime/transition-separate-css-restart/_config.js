import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, raf }) {
		const toggle = () => flushSync(() => target.querySelector('button').click());
		toggle();
		const div = target.querySelector('div');
		assert.equal(div.style.scale, '0');
		raf.tick(50);
		toggle();
		assert.equal(div.style.scale, '0.5');
		assert.equal(div.style.opacity, '1');
		assert.equal(div.style.rotate, '360deg');
		raf.tick(75);
		assert.equal(div.style.scale, '0.75');
		assert.equal(div.style.opacity, '0.75');
		assert.equal(div.style.rotate, '270deg');
		toggle();
		assert.equal(div.style.scale, '0');
		assert.equal(div.style.opacity, '1');
		assert.equal(div.style.rotate, '360deg');
	}
});
