import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, logs }) {
		assert.deepEqual(logs, ['hello from child']);
	}
});
