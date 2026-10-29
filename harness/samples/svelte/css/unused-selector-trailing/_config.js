import { test } from '@vigla/harness/helpers';

export default test({
	warnings: [
		{
			code: 'css_unused_selector',
			end: {
				character: 32,
				column: 3,
				line: 5
			},
			message: 'Unused CSS selector "h2"',
			start: {
				character: 30,
				column: 1,
				line: 5
			}
		}
	]
});
