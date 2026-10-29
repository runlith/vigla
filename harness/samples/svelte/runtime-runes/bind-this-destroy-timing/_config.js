import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [btn] = target.querySelectorAll('button');

		btn.click();
		await tick();
		assert.htmlEqual(
			target.innerHTML,
			`
				<button>clear</button>
				<p></p>
			`
		);
	}
});
