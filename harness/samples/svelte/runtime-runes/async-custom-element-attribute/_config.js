import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ target, assert }) {
		await tick();
		const [element] = target.querySelectorAll('async-custom-element');

		assert.htmlEqual(element.innerHTML, `Hello foobar!`);
	}
});
