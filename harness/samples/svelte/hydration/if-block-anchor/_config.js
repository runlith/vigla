import { test } from '@vigla/harness/helpers';

export default test({
	props: {
		foo: true,
		bar: true
	},
	trim_whitespace: false,

	snapshot(target) {
		const div = target.querySelector('div');
		const ps = target.querySelectorAll('p');

		return {
			div,
			p0: ps[0],
			p1: ps[1]
		};
	}
});
