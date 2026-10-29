import { test } from '@vigla/harness/helpers';

export default test({
	server_props: {
		html: '<div></div>'
	},

	props: {
		html: '<div></div>'
	},

	test(assert, target) {
		assert.htmlEqual(target.innerHTML, '<div></div>');
	}
});
