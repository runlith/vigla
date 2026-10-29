import * as assert from 'node:assert';
import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		style: ({ attributes }) => {
			assert.deepEqual(attributes, {
				lang: 'scss',
				'data-foo': 'bar',
				bool: true
			});
			return { code: 'PROCESSED', attributes: { sth: 'else' } };
		}
	}
});
