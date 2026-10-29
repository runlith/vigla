import { flushSync } from 'svelte';
import { assert_ok, test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		experimental: {
			async: true
		}
	}
});
