import { test } from '@dromon/harness/helpers';

export default test({
	snapshot(target) {
		return {
			p: target.querySelector('p')
		};
	}
});
