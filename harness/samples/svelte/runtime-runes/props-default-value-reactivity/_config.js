import { flushSync, tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target }) {
		const btn = target.querySelector('button');

		btn?.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`
			<p>greeting: Hola</p>
			<button>Change Language</button>
			`
		);
	}
});
