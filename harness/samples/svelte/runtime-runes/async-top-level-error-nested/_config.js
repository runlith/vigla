import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: `<button>reject</button> <p>pending</p>`,

	async test({ assert, target }) {
		const [reject] = target.querySelectorAll('button');

		reject.click();
		await tick();
		assert.htmlEqual(target.innerHTML, '<button>reject</button> <p>failed</p>');
	}
});
