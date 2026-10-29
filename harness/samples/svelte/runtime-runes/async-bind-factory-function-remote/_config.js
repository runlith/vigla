import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['async-server', 'client', 'hydrate'],
	ssrHtml: 'true true true true true true',

	async test({ assert, target }) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		await tick();

		assert.htmlEqual(target.innerHTML, 'true true true true true true');
	}
});
