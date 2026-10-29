import { test } from '@dromon/harness/helpers';

export default test({
	props: {
		foo: true
	},

	snapshot(target) {
		const p = target.querySelector('p');

		return {
			p
		};
	}
});
