import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	props: { value: 'a' },
	test({ assert, component, target }) {
		const p = target.querySelector('p');
		assert.equal(p?.parentElement?.localName, 'annotation-xml');
		assert.equal(p?.namespaceURI, 'http://www.w3.org/1999/xhtml');

		const spread = target.querySelectorAll('annotation-xml')[1];
		assert.equal(spread?.getAttribute('value'), 'a');
		component.value = 'b';
		flushSync();
		assert.equal(spread?.getAttribute('value'), 'b');
	}
});
