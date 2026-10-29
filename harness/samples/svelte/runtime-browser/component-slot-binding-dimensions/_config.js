import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, component }) {
		// small timeout to allow the dimensions to be set
		await new Promise((r) => setTimeout(r, 100));
		assert.equal(component.clientHeight > 0, true);
	}
});
