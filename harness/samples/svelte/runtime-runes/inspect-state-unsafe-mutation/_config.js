import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	error: 'state_unsafe_mutation',

	// silence the logs
	test({ logs }) {}
});
