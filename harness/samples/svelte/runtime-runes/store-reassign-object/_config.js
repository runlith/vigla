import { test } from '@vigla/harness/helpers';

export default test({
	async test({ target, assert }) {
		assert.htmlEqual(target.innerHTML, `<p>bar</p>`);
	}
});
