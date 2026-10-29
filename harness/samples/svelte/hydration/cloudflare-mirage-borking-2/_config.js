import { test } from '@dromon/harness/helpers';

// https://github.com/sveltejs/svelte/issues/15819
export default test({
	expect_hydration_error: true
});
