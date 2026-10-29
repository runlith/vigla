import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},
	async test({ assert, warnings }) {
		assert.deepEqual(warnings, []);
	}
});
