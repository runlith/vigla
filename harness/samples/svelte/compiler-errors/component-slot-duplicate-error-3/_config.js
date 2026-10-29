import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'slot_attribute_duplicate',
		message: "Duplicate slot name 'foo' in <Nested>"
	}
});
