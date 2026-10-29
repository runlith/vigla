import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, logs }) {
		assert.deepEqual(logs, [0n, 1n, 2n, 3n, 4n, 5n]);
	}
});
