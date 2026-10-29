import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'rune_invalid_name',
		message: '`$state.foo` is not a valid rune'
	}
});
