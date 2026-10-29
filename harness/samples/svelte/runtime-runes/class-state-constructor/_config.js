import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: `<button>20</button>`,

	test({ assert, target }) {
		const btn = target.querySelector('button');

		flushSync(() => {
			btn?.click();
		});
		assert.htmlEqual(target.innerHTML, `<button>22</button>`);

		flushSync(() => {
			btn?.click();
		});
		assert.htmlEqual(target.innerHTML, `<button>24</button>`);
	}
});
