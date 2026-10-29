import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	html: `<button>update</button><div></div>`,

	test({ target, assert, logs }) {
		const button = target.querySelector('button');

		assert.deepEqual(logs, ['one DIV']);

		flushSync(() => button?.click());
		assert.deepEqual(logs, ['one DIV', 'cleanup one', 'two DIV']);
	}
});
