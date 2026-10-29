import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, 'foo <button>A button</button>');
	}
});
