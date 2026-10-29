import { test } from '@vigla/harness/helpers';

export default test({
	snapshot(target) {
		return {
			main: target.querySelector('main'),
			p: target.querySelector('p')
		};
	}
});
