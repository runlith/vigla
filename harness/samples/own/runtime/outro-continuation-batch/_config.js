import { flushSync, settled, tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, instance, raf, target }) {
		await settled();
		const child = target.querySelector('i');
		assert.ok(child);
		flushSync(() => instance.hold());
		await tick();
		instance.release();
		await Promise.resolve();
		instance.remove();
		await settled();
		assert.equal(child.dataset.value, '1');
		raf.tick(100);
		assert.equal(target.querySelector('i'), null);
		assert.equal(target.querySelector('output').textContent, '1');
	}
});
