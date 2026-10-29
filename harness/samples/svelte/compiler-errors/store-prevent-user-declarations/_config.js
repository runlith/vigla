import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'dollar_prefix_invalid',
		message: 'The $ prefix is reserved, and cannot be used for variables and imports'
	}
});
