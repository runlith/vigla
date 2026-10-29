import { test } from '@vigla/harness/helpers';

export default test({
	warnings: [
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".hover.unused"',
			start: { line: 15, column: 2, character: 257 },
			end: { line: 15, column: 15, character: 270 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".unused"',
			start: { line: 17, column: 2, character: 291 },
			end: { line: 17, column: 9, character: 298 }
		}
	]
});
