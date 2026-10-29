import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		const btn = target.querySelector('button');

		flushSync(() => {
			btn?.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<p>test_store:\n 4</p><p>counter:\n 4</p><button>+1</button>`
		);

		flushSync(() => {
			btn?.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<p>test_store:\n 5</p><p>counter:\n 5</p><button>+1</button>`
		);
	}
});
