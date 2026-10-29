import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},
	async test({ assert, errors }) {
		assert.deepEqual(errors, []);
	}
});
