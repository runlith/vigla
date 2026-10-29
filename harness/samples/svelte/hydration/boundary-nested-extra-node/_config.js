import { test } from '@vigla/harness/helpers';

// https://github.com/sveltejs/svelte/issues/18924
export default test({
	expect_hydration_error: true
});
