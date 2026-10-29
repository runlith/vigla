import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'attribute_unquoted_sequence',
		message:
			'Attribute values containing `{...}` must be enclosed in quote marks, unless the value only contains the expression',
		position: [101, 116]
	}
});
