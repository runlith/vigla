import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},
	mode: ['server'],
	async test({ errors, assert }) {
		assert.equal(errors, []);
	}
});
