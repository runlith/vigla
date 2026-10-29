import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';
import { raf } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [btn] = target.querySelectorAll('button');

		btn.click();
		await tick();
		raf.tick(100);
		assert.htmlEqual(target.innerHTML, `<button>clear</button>`);
	}
});
