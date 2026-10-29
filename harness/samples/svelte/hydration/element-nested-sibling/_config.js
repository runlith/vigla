import { assert_ok, test } from '@dromon/harness/helpers';

export default test({
	snapshot(target) {
		const p = target.querySelector('p');
		assert_ok(p);

		return {
			p,
			span: p.querySelector('span'),
			code: p.querySelector('code')
		};
	}
});
