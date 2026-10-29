import { test, ok } from '@dromon/harness/helpers';

export default test({
	html: `<svg><title>potato</title></svg>`,
	test({ assert, target }) {
		const title = target.querySelector('title');
		ok(title);

		assert.equal(title.namespaceURI, 'http://www.w3.org/2000/svg');
	}
});
