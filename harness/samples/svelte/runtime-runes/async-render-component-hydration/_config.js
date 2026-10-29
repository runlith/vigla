import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(
			target.innerHTML,
			`<a href="/"><div>card</div> <img src="https://svelte.dev" /></a>`
		);
	}
});
