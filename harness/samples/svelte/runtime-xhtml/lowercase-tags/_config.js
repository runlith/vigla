import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target }) {
		const [input] = target.querySelectorAll('input');

		assert.equal(input.disabled, true);
	}
});
