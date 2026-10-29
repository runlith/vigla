import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	ssrHtml: 'works',
	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, 'works');
	}
});
