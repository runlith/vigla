import { normalise_inspect_logs } from '@dromon/harness/helpers';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, logs, target }) {
		const [btn] = target.querySelectorAll('button');
		btn.click();
		btn.click();
		await Promise.resolve();

		assert.deepEqual(normalise_inspect_logs(logs), [
			[],
			[{}],
			'at HTMLButtonElement.click',
			[{}, {}],
			'at HTMLButtonElement.click'
		]);
	}
});
