import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, logs }) {
		assert.deepEqual(logs, ['invoked']);
	},
	test_ssr({ assert, logs }) {
		assert.deepEqual(logs, ['invoked']);
	}
});
