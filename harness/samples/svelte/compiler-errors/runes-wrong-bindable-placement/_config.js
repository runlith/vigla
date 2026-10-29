import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'bindable_invalid_location',
		message: '`$bindable()` can only be used inside a `$props()` declaration'
	}
});
