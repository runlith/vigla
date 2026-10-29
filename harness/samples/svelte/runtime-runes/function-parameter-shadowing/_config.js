import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, logs }) {
		assert.deepEqual(logs, [42, 43]);
	}
});
