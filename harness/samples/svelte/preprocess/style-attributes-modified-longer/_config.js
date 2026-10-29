import * as assert from 'node:assert';
import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		style: ({ attributes }) => {
			assert.deepEqual(attributes, {
				lang: 'scss'
			});
			return { code: 'PROCESSED', attributes: { sth: 'wayyyyyyyyyyyyy looooooonger' } };
		}
	}
});
