import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'css_global_block_invalid_declaration',
		message: 'A top-level `:global {...}` block can only contain rules, not declarations',
		position: [109, 119]
	}
});
