import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target, logs }) {
		const [s1] = target.querySelectorAll('span');

		s1?.click();
		await Promise.resolve();

		assert.deepEqual(logs, [false]);
	}
});
