import { test } from '@dromon/harness/helpers';

export default test({
	async test({ logs, assert }) {
		assert.deepEqual(logs, ['world']);
	}
});
