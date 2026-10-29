import { ok, test } from '@vigla/harness/helpers';

export default test({
	test({ target }) {
		const button = target.querySelector('button');
		ok(button);
		button.click();
	}
});
