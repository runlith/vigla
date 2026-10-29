import { test } from '@dromon/harness/helpers';

export default test({
	snapshot(target) {
		const div = target.querySelector('div');

		return {
			div,
			p: div?.querySelector('p')
		};
	}
});
