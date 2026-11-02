import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	test({ assert, target }) {
		assert.deepEqual(
			Array.from(target.querySelectorAll('a'), (element) => element.namespaceURI),
			[
				'http://www.w3.org/1999/xhtml',
				'http://www.w3.org/1999/xhtml',
				'http://www.w3.org/1999/xhtml'
			]
		);
		assert.deepEqual(
			Array.from(target.querySelectorAll('title'), (element) => element.namespaceURI),
			['http://www.w3.org/1999/xhtml']
		);
		assert.deepEqual(
			Array.from(target.querySelectorAll('text'), (element) => element.namespaceURI),
			['http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg']
		);
	}
});
