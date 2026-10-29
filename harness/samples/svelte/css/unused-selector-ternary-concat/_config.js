import { test } from '@dromon/harness/helpers';

export default test({
	warnings: [
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".unused"',
			start: {
				character: 206,
				column: 2,
				line: 14
			},
			end: {
				character: 213,
				column: 9,
				line: 14
			}
		}
	]
});
