import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, logs }) {
		assert.deepEqual(logs, ['onfocus']);
	}
});
