import { test } from '@dromon/harness/helpers';

export default test({
	html: `<p>42</p>`,

	async test({ assert, target, window, component }) {
		assert.equal(component.answer, undefined);
	}
});
