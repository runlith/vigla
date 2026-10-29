import { ok, test } from '@vigla/harness/helpers';

export default test({
	async test({ target }) {
		const button = target.querySelector('button');
		ok(button);
		button.dispatchEvent(new window.MouseEvent('mouseenter'));
	}
});
