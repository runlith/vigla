import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		const button = target.querySelector('button');

		button?.click();
		await tick();

		assert.htmlEqual(
			target.innerHTML,
			`
				<button>show</button>
				<p>1</p>
			`
		);
	}
});
