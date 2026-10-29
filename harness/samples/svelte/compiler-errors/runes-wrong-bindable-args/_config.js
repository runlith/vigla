import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'rune_invalid_arguments_length',
		message: '`$bindable` must be called with zero or one arguments'
	}
});
