import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: {
		runes: undefined
	},
	async test({ assert, target }) {
		const p = target.querySelector('p');
		const btn = target.querySelector('button');
		flushSync(() => {
			btn?.click();
		});
		assert.equal(p?.innerHTML, '1');
	}
});
