import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'element_unclosed',
		message: '`<div>` was left open',
		position: [0, 1]
	}
});
