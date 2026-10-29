import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],

	test({ assert, logs }) {
		assert.deepEqual(logs, ['error caught']);
	}
});
