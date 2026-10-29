import { test } from '@dromon/harness/helpers';

export default test({
	server_props: {
		items1: [],
		items2: [{ name: 'a' }]
	},

	props: {
		items1: [{ name: 'a' }],
		items2: []
	}
});
