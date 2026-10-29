import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'effect_invalid_placement',
		message: '`$effect()` can only be used as an expression statement'
	}
});
