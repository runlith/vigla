import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target, window }) {
		const toggle = () => flushSync(() => target.querySelector('button').click());
		toggle();
		let heading = target.querySelector('h1');
		heading.focus();
		window.getSelection().selectAllChildren(heading);
		window.document.execCommand('delete');
		flushSync();
		toggle();
		toggle();
		heading = target.querySelector('h1');
		heading.focus();
		window.document.execCommand('insertText', false, 'abc');
		flushSync();
		assert.equal(heading.textContent, 'abc');
		assert.equal(target.querySelector('output').textContent, 'abc');
	}
});
