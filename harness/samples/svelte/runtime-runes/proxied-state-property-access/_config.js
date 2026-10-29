import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: `<button>click true</button> Child: true`,

	async test({ assert, target }) {
		const btn = target.querySelector('button');

		flushSync(() => {
			btn?.click();
		});

		assert.htmlEqual(target.innerHTML, `<button>click false</button> Child: false`);

		flushSync(() => {
			btn?.click();
		});

		assert.htmlEqual(target.innerHTML, `<button>click true</button> Child: true`);
	}
});
