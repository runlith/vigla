import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	html: `<button></button>`,

	test({ assert, target }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();

		assert.htmlEqual(target.innerHTML, `<button>foo</button>`);
	}
});
