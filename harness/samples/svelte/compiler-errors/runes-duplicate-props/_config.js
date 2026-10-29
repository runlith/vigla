import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'props_duplicate',
		message: 'Cannot use `$props()` more than once'
	}
});
