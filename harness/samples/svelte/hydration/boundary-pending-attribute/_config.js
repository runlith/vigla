import { flushSync } from 'svelte';
import { assert_ok, test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		experimental: {
			async: true
		}
	}
});
