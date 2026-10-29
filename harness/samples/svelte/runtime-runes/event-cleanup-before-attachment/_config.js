import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, logs }) {
		await new Promise((resolve) => setTimeout(resolve));
		assert.deepEqual(logs, []);
	}
});
