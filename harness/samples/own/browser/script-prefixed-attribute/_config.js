import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, window }) {
		assert.equal(window.document.documentElement.getAttribute('data-script-language'), 'en');
	}
});
