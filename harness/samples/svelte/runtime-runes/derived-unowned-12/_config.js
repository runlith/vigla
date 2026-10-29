import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		let [btn1, btn2] = target.querySelectorAll('button');

		btn1?.click();
		flushSync();

		btn2?.click();
		flushSync();

		btn1?.click();
		flushSync();

		btn1?.click();
		flushSync();

		assert.htmlEqual(
			target.innerHTML,
			`<button>linked.current</button>\n3\n<button>count</button>\n1`
		);
	}
});
