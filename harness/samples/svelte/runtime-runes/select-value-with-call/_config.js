import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, errors }) {
		assert.deepEqual(errors, []);
	}
});
