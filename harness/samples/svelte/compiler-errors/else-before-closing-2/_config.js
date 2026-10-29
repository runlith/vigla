import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'expected_token',
		message: 'Expected token {:then ...} or {:catch ...}',
		position: [24, 24]
	}
});
