import { assert_ok, test } from '@dromon/harness/helpers';

export default test({
	snapshot(target) {
		const p = target.querySelector('p');
		assert_ok(p);

		return {
			p,
			text: p.childNodes[0],
			span: p.querySelector('span')
		};
	}
});
