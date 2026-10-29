import { test } from '@dromon/harness/helpers';

export default test({
	ssrHtml: `<input value="foo">`,

	test({ assert, target }) {
		assert.equal(target.querySelector('input')?.value, 'foo');
	}
});
