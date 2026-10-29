import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'void_element_invalid_content',
		message: 'Void elements cannot have children or closing tags',
		position: [23, 23]
	}
});
