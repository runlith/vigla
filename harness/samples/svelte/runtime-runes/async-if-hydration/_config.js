import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['hydrate'],

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, `<div><p>hello</p></div> <div>true</div>`);
	}
});
