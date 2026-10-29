import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'element_invalid_closing_tag',
		message: '`</p>` attempted to close an element that was not open',
		position: [38, 38]
	}
});
