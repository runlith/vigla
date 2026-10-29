import * as assert from 'node:assert';
import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		script: ({ content, attributes }) => {
			assert.equal(content, '');
			return {
				code: `console.log("${attributes['the-answer']}");`
			};
		}
	}
});
