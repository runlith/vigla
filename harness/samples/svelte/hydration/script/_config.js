import { test } from '@dromon/harness/helpers';

export default test({
	snapshot(target) {
		const script = target.querySelector('script');

		return {
			script
		};
	}
});
