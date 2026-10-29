import { test } from '@vigla/harness/helpers';

export default test({
	test({ assert, target }) {
		assert.htmlEqual(target.innerHTML, `<input type="text"><span>hello</span>`);
	}
});
