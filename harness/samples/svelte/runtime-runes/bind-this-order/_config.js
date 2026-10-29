import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();
		assert.htmlEqual(target.innerHTML, `<button>toggle</button> <nav>hello</nav>`);
	}
});
