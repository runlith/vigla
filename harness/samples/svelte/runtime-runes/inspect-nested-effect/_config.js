import { normalise_inspect_logs } from '@dromon/harness/helpers';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, logs }) {
		assert.deepEqual(normalise_inspect_logs(logs), [0, 1, 'at $effect']);
	}
});
