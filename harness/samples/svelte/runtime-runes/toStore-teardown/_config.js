import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		let [, btn2] = target.querySelectorAll('button');

		btn2.click();
		flushSync();

		assert.htmlEqual(target.innerHTML, `<button>Set data</button><button>Clear data</button>`);
	}
});
