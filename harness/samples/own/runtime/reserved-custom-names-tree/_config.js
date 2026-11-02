import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { fragments: 'tree' },
	test({ assert, target }) {
		const p = target.querySelector('p');
		assert.equal(p?.parentElement?.localName, 'annotation-xml');
		assert.equal(p?.namespaceURI, 'http://www.w3.org/1999/xhtml');
	}
});
