import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'js_parse_error',
		message: 'Assigning to rvalue',
		position: [1, 1]
	}
});
