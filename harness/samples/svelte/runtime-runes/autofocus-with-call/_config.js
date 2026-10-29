import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, errors }) {
		assert.deepEqual(errors, []);
	}
});
