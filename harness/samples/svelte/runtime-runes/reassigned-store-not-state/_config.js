import { test } from '@vigla/harness/helpers';

export default test({
	async test({ logs, assert }) {
		assert.deepEqual(logs, ['world']);
	}
});
