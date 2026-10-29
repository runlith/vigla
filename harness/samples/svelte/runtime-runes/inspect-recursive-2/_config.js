import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, logs }) {
		var a = {
			a: {}
		};
		a.a = a;

		var b = {
			a: {
				b: {}
			}
		};
		b.a.b = b;

		assert.deepEqual(logs, [a, b]);
	}
});
