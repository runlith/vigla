import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'constant_assignment',
		message: 'Cannot assign to constant'
	}
});
