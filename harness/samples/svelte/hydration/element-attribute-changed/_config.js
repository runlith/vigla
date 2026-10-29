import { test } from '@vigla/harness/helpers';

export default test({
	server_props: {
		className: 'foo'
	},

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
