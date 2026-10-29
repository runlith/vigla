import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'slot_attribute_duplicate',
		message: "Duplicate slot name 'foo' in <Nested>"
	}
});
