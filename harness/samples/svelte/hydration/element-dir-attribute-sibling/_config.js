import { test } from '@dromon/harness/helpers';

export default test({
	test(assert, target) {
		const p = target.querySelector('p');

		assert.equal(p?.dir, 'rtl');
	}
});
