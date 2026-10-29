import { test } from '@vigla/harness/helpers';

export default test({
	server_props: {
		id: 'foo'
	},

	snapshot(target) {
		const div = target.querySelector('div');

		return {
			div
		};
	}
});
