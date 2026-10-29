import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		await tick();

		const p = target.querySelector('p');
		assert.equal(p?.innerHTML, 'hello');
		assert.equal(window.document.title, 'hello');
	}
});
