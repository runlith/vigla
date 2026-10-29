import { test } from '@vigla/harness/helpers';

export default test({
	warnings: [
		{
			code: 'css_unused_selector',
			end: {
				character: 109,
				column: 11,
				line: 11
			},
			message: 'Unused CSS selector "~ .unused"',
			start: {
				character: 100,
				column: 2,
				line: 11
			}
		}
	]
});
