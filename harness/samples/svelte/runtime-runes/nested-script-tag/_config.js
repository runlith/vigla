import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],

	async test({ assert, logs }) {
		assert.deepEqual(logs, ['init']);
	}
});
