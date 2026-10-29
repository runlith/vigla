import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	html: `Loading`,
	async test({ assert, target }) {
		await Promise.resolve();
		flushSync();

		assert.htmlEqual(target.innerHTML, `1`);
	}
});
