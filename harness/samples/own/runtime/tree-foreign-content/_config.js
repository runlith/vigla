import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { fragments: 'tree' },
	test({ assert, target }) {
		assert.equal(target.querySelector('svg')?.getAttribute('viewBox'), '0 0 10 10');
		const use = target.querySelector('use');
		assert.equal(use?.getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#icon');
		assert.equal(target.querySelector('b')?.namespaceURI, 'http://www.w3.org/1999/xhtml');
	}
});
