import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, window }) {
		const input = target.querySelector('input');
		input.value = 'a';
		flushSync(() => input.dispatchEvent(new window.Event('input', { bubbles: true })));
		assert.equal(target.querySelector('p').textContent, 'native:a|handler:a');
		flushSync(() => target.querySelector('button').click());
		input.value = 'ab';
		flushSync(() => input.dispatchEvent(new window.Event('input', { bubbles: true })));
		assert.equal(target.querySelector('p').textContent, 'native:a|handler:a|native:ab');
	}
});
