import { ok, test } from '@dromon/harness/helpers';

export default test({
	test({ target }) {
		const button = target.querySelector('button');
		ok(button);
		button.click();
	}
});
