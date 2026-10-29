import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'block_duplicate_clause',
		message: '{:else} cannot appear more than once within a block',
		position: [42, 42]
	}
});
