import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'css_global_block_invalid_list',
		message:
			"A `:global` selector cannot be part of a selector list with entries that don't contain `:global`",
		position: [24, 43]
	}
});
