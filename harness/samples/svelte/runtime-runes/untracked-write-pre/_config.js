import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target, logs }) {
		assert.deepEqual(logs, ['Outer', 'Inner', 'Outer', 'Inner']);
	}
});
