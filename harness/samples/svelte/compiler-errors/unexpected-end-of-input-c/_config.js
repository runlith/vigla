import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'unexpected_eof',
		message: 'Unexpected end of input',
		position: [1, 1]
	}
});
