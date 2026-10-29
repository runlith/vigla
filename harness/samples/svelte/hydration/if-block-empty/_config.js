import { test } from '@dromon/harness/helpers';

export default test({
	server_props: {
		foo: ''
	},

	props: {
		foo: 'x'
	}
});
