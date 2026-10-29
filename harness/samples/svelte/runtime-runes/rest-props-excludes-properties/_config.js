import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target }) {
		assert.equal(target.textContent, ' false');
	}
});
