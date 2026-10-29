import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, logs }) {
		assert.deepEqual(logs, [1]);
	}
});
