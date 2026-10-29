import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		let [btn1] = target.querySelectorAll('button');

		flushSync(() => {
			btn1.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<button>update</button><div>2</div><div>2</div><div>2</div><div>2</div>`
		);
	}
});
