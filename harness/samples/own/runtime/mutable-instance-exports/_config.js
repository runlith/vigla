import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	compileOptions: { dev: true },
	test({ assert, instance, target }) {
		flushSync(() => {
			instance.plain = 1;
			instance.value = 2;
			instance.raw = 3;
		});
		assert.deepEqual([instance.plain, instance.value, instance.raw, instance.fixed], [1, 2, 3, 0]);
		assert.htmlEqual(target.innerHTML, '<p>2/3</p>');
		assert.throws(() => instance.fixed = 4, TypeError);
	}
});
