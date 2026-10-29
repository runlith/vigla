import { assert_ok, test } from '@dromon/harness/helpers';

export default test({
	server_props: {
		items: []
	},

	props: {
		items: [{ name: 'a' }]
	},

	snapshot(target) {
		const ul = target.querySelector('ul');
		assert_ok(ul);

		return {
			ul
		};
	}
});
