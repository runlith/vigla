import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target, logs }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();

		assert.deepEqual(logs, ['error caught']);
		assert.htmlEqual(target.innerHTML, `<div>Fallback!</div><button>+</button>`);
	}
});
