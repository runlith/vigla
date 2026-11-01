import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, window }) {
		const select = target.querySelector('select');
		const selected = [];
		for (const index of [1, 2]) {
			select.selectedIndex = index;
			flushSync(() => select.dispatchEvent(new window.Event('change')));
			selected.push(target.querySelector('p').textContent);
		}
		assert.deepEqual(selected, ['undefined', 'null']);
	}
});
