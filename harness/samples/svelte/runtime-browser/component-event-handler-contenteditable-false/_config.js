import { flushSync } from 'svelte';
import { assert_ok, test } from '@dromon/harness/helpers';

// A browser test because JSDOM doesn't support contenteditable
export default test({
	html: '<div contenteditable="false"></div>',

	async test({ assert, target, component, window }) {
		const div = target.querySelector('div');
		assert_ok(div);
		const text = window.document.createTextNode('a');
		div.insertBefore(text, null);
		assert.equal(div.textContent, 'a');
		flushSync(() => (component.text = 'bcde'));
		assert.equal(div.textContent, 'bcdea');
	}
});
