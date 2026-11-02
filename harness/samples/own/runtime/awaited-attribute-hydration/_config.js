import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],
	server_props: { value: 'x' },
	props: { value: undefined },
	async test({ assert, target }) {
		await tick();
		const p = target.querySelector('p');
		assert.isFalse(p?.hasAttribute('data-x'));
		assert.isFalse(p?.hasAttribute('style'));

		const input = target.querySelector('input');
		input.value = 'edited';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		target.querySelector('form')?.reset();
		await tick();
		assert.equal(input.value, '');
	}
});
