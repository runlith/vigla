import { test } from '@vigla/harness/helpers';

export default test({
	skip_no_async: true,
	mode: ['hydrate'],
	async test({ assert, warnings }) {
		assert.deepEqual(warnings, []); // TODO not quite sure why this isn't populated yet
	}
});
