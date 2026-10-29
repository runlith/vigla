import { tick } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, target, warnings }) {
		await tick();

		const [count] = target.querySelectorAll('button');

		count.click();
		await tick();

		assert.equal(warnings.length, 0);
	}
});
