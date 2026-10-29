import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [button] = target.querySelectorAll('button');

		button.click();
		flushSync();

		assert.htmlEqual(target.innerHTML, '<button>Reproduce</button><p>Deferred outro</p>');
	}
});
