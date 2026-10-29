import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},
	async test({ assert, logs }) {
		assert.deepEqual(logs, [1, 1]);
	}
});
