import { normalise_inspect_logs } from '@vigla/harness/helpers';
import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, target, logs }) {
		const [btn] = target.querySelectorAll('button');
		btn.click();
		await Promise.resolve();

		assert.deepEqual(normalise_inspect_logs(logs), [
			{},
			[],
			{ x: 'hello' },
			'at HTMLButtonElement.click',
			['hello'],
			'at HTMLButtonElement.click'
		]);
	}
});
