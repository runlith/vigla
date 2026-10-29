import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'attribute_duplicate',
		message: 'Attributes need to be unique',
		position: [23, 40]
	}
});
