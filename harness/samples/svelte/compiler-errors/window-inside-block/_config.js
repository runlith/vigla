import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'svelte_meta_invalid_placement',
		message: '`<svelte:window>` tags cannot be inside elements or blocks',
		position: [11, 11]
	}
});
