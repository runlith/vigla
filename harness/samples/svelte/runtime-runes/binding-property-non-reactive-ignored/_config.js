import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: {
		dev: true
	},
	async test({ warnings, assert }) {
		assert.deepEqual(warnings, []);
	}
});
