import { tick } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],
	server_props: { fail: true },
	props: { fail: false },
	transformError: () => 'transformed',

	async test({ assert, target }) {
		await tick();
		assert.htmlEqual(target.innerHTML, '<p>outer failed</p><p>after</p>');
	}
});
