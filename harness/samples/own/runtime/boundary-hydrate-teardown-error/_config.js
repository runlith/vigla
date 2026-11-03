import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],
	server_props: { client: false },
	props: { client: true },

	async test({ assert, target }) {
		await tick();
		assert.equal(target.querySelectorAll('p').length, 1);
	}
});
