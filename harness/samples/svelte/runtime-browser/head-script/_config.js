import { test } from '@dromon/harness/helpers';

export default test({
	test({ assert, window }) {
		document.dispatchEvent(new Event('DOMContentLoaded'));
		assert.equal(window.document.querySelector('button')?.textContent, 'Hello world');
	}
});
