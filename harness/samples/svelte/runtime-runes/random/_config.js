import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target }) {
		const [p1, p2] = target.querySelectorAll('p');
		assert.notEqual(p1.textContent, p2.textContent);
	}
});
