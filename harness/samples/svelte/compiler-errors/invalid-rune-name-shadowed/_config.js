import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'rune_invalid_name',
		message: '`$state.foo` is not a valid rune'
	}
});
