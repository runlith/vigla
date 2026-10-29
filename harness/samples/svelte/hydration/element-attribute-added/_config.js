import { test } from '@dromon/harness/helpers';

export default test({
	server_props: {},

	props: {
		className: 'bar'
	},

	snapshot(target) {
		const div = target.querySelector('div');

		return {
			div
		};
	}
});
