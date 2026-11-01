import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		const update = target.querySelector('[data-control="update"]');
		const hide = target.querySelector('[data-control="hide"]');
		const elements = [...target.querySelectorAll('[data-item]')];
		const count = () => target.querySelector('p').textContent;
		for (const expected of ['1', '2', '12', '13', '13', '14']) {
			flushSync(() => elements[0].click());
			assert.equal(count(), expected);
			if (expected !== '14') flushSync(() => update.click());
		}
		flushSync(() => {
			elements[1].click();
			elements[2].click();
		});
		assert.equal(count(), '1114');
		flushSync(() => hide.click());
		for (const element of elements) {
			target.append(element);
			flushSync(() => element.click());
			element.remove();
		}
		assert.equal(count(), '1114');
	}
});
