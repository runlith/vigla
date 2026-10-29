import { test } from '@vigla/harness/helpers';

export default test({
	props: {
		foo: false
	},

	snapshot(target) {
		const p = target.querySelector('p');

		return {
			p
		};
	}
});
