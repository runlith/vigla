import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, target }) {
		assert.equal(target.ownerDocument.title, '');
	}
});
