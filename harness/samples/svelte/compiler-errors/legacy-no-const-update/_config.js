import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'constant_assignment',
		message: 'Cannot assign to constant'
	}
});
