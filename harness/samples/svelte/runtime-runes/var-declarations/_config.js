import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, logs }) {
		assert.deepEqual(logs, [undefined, undefined, 10, 20, 0, 1]);
	}
});
