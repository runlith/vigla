import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

// Tests that context is restored after await (const has to wait on a blocker), so that getContext etc work correctly
export default test({
	mode: ['hydrate', 'async-server', 'client'],
	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, 'hi');
	}
});
