import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, window }) {
		const input = target.querySelector('input');
		const count = () => target.querySelector('p').textContent;
		flushSync(() => {
			input.dispatchEvent(new window.Event('focus'));
			input.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		assert.equal(count(), '1:1');
		flushSync(() => target.querySelector('button').click());
		flushSync(() => {
			input.dispatchEvent(new window.Event('focus'));
			target.append(input);
			input.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
			input.remove();
		});
		assert.equal(count(), '1:1');
	}
});
