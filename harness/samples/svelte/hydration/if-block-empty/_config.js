import { test } from '@vigla/harness/helpers';

export default test({
	server_props: {
		foo: ''
	},

	props: {
		foo: 'x'
	}
});
