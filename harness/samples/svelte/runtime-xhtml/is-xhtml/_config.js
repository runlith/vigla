import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		assert.htmlEqual(target.innerHTML, `<div>div</div>`);
	}
});
