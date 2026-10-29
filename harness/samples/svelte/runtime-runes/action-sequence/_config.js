import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, logs }) {
		assert.deepEqual(logs, ['1', '2', '3', '4', '5', '6']);
	}
});
