import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		assert.htmlEqual(target.innerHTML, `<div>123</div>`);

		assert.deepEqual(logs, ['123', '123']);
	}
});
