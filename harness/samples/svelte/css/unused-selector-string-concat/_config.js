import { test } from '@dromon/harness/helpers';

export default test({
	warnings: [
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".fooaa"',
			start: { line: 11, column: 2, character: 214 },
			end: { line: 11, column: 8, character: 220 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".foobb"',
			start: { line: 12, column: 2, character: 237 },
			end: { line: 12, column: 8, character: 243 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".foodd"',
			start: { line: 14, column: 2, character: 283 },
			end: { line: 14, column: 8, character: 289 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".bbbar"',
			start: { line: 20, column: 2, character: 409 },
			end: { line: 20, column: 8, character: 415 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".ccbar"',
			start: { line: 21, column: 2, character: 432 },
			end: { line: 21, column: 8, character: 438 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".ddbar"',
			start: { line: 22, column: 2, character: 455 },
			end: { line: 22, column: 8, character: 461 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".fooaabar"',
			start: { line: 23, column: 2, character: 478 },
			end: { line: 23, column: 11, character: 487 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".foobbbar"',
			start: { line: 24, column: 2, character: 504 },
			end: { line: 24, column: 11, character: 513 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".fooccbar"',
			start: { line: 25, column: 2, character: 530 },
			end: { line: 25, column: 11, character: 539 }
		},
		{
			code: 'css_unused_selector',
			message: 'Unused CSS selector ".unused"',
			start: { line: 28, column: 2, character: 603 },
			end: { line: 28, column: 9, character: 610 }
		}
	]
});
