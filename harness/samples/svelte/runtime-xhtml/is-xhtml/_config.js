import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		assert.htmlEqual(target.innerHTML, `<div>div</div>`);
	}
});
