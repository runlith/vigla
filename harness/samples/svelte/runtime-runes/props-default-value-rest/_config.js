import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target }) {
		const [btn1, btn2] = target.querySelectorAll('button');

		btn1.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`<button>set color</button> <button>set options</button> bar bar`
		);

		btn2.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`<button>set color</button> <button>set options</button> baz bar`
		);

		btn1.click();
		flushSync();
		assert.htmlEqual(
			target.innerHTML,
			`<button>set color</button> <button>set options</button> foo bar`
		);
	}
});
