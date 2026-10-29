import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'const_tag_invalid_expression',
		message: '{@const ...} must consist of a single variable declaration',
		position: [75, 93]
	}
});
