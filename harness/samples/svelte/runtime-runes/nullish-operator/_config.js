import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, logs }) {
		await Promise.resolve();
		await Promise.resolve();
		assert.deepEqual(logs, ['a1: ', true, 'b1: ', true]);
	}
});
