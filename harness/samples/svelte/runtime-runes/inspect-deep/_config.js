import { normalise_inspect_logs } from '@vigla/harness/helpers';
import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, logs }) {
		assert.deepEqual(normalise_inspect_logs(logs), [undefined, [{}], 'at $effect']);
	}
});
