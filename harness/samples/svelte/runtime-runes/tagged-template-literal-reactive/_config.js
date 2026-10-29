import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target, ok }) {
		const button = target.querySelector('button');

		assert.htmlEqual(target.innerHTML, `0 <button></button>`);

		flushSync(() => {
			button?.click();
		});

		assert.htmlEqual(target.innerHTML, `1 <button></button>`);
	}
});
