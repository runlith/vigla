import { ok, test } from '@dromon/harness/helpers';

export default test({
	async test({ target }) {
		const button = target.querySelector('button');
		ok(button);
		button.dispatchEvent(new window.MouseEvent('mouseenter'));
	}
});
