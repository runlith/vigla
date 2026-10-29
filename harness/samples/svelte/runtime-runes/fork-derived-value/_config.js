import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	skip_no_async: true,
	async test({ assert, target }) {
		const [fork, update] = target.querySelectorAll('button');

		flushSync(() => {
			fork.click();
		});
		flushSync(() => {
			update.click();
		});

		const p = target.querySelector('p');

		assert.equal(p?.textContent, 'one');
	}
});
