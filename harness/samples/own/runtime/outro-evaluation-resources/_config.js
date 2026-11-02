import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, instance, raf, target }) {
		flushSync(() => instance.remove());
		const historical = instance.historical();
		const current = instance.current();
		assert.equal(historical.value, 1);
		assert.equal(current.value, 2);
		flushSync(() => instance.observe());
		raf.tick(100);
		assert.equal(historical.signal.aborted, true);
		assert.equal(current.signal.aborted, false);
		assert.notEqual(historical.signal, current.signal);
		assert.htmlEqual(target.innerHTML, '<output>2</output>');
	}
});
