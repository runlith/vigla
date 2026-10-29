import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'store_invalid_subscription_module',
		message: 'Cannot reference store value outside a `.svelte` file'
	}
});
