import { test } from '@dromon/harness/helpers';

export default test({
	props: { h1: undefined },

	snapshot(target) {
		const h1 = target.querySelector('h1');

		return {
			h1
		};
	},

	test(assert, target, _, component) {
		const h1 = target.querySelector('h1');
		assert.equal(component.h1, h1);
	}
});
