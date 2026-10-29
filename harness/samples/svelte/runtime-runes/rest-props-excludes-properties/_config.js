import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		assert.equal(target.textContent, ' false');
	}
});
