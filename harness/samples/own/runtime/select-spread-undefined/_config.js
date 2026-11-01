import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	props: { value: 'a' },
	test({ assert, target, component }) {
		const [updated, initial] = target.querySelectorAll('select');
		assert.deepEqual([updated.selectedIndex, initial.selectedIndex], [0, 0]);
		flushSync(() => component.value = undefined);
		assert.equal(updated.selectedIndex, -1);
	}
});
