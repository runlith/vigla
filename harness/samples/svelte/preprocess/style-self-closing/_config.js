import * as assert from 'node:assert';
import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		style: ({ content, attributes: { color } }) => {
			assert.equal(content, '');
			return {
				code: `div { color: ${color}; }`
			};
		}
	}
});
