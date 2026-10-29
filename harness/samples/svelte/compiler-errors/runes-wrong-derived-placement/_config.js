import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'state_invalid_placement',
		message:
			'`$derived(...)` can only be used as a variable declaration initializer, a class field declaration, or the first assignment to a class field at the top level of the constructor.'
	}
});
