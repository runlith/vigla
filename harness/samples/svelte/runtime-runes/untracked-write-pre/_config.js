import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target, logs }) {
		assert.deepEqual(logs, ['Outer', 'Inner', 'Outer', 'Inner']);
	}
});
