import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'block_unclosed',
		message: 'Block was left open',
		position: [0, 1]
	}
});
