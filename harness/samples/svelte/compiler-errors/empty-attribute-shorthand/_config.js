import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'attribute_empty_shorthand',
		message: 'Attribute shorthand cannot be empty',
		position: [6, 6]
	}
});
