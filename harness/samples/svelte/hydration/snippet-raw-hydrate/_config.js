import { test } from '@vigla/harness/helpers';

export default test({
	snapshot(target) {
		return {
			p: target.querySelector('p')
		};
	}
});
