import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		preserveComments: true
	},
	snapshot(target) {
		return {
			div: target.querySelectorAll('div')[1]
		};
	}
});
