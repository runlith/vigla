import { test } from '@dromon/harness/helpers';

// https://github.com/sveltejs/svelte/issues/18924
export default test({
	expect_hydration_error: true
});
