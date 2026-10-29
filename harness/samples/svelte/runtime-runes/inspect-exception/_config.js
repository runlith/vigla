import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	async test({ assert, target, logs, errors }) {
		const b1 = target.querySelector('button');
		b1?.click();
		flushSync();

		assert.equal(errors.length, 0);
		assert.deepEqual(logs, ['init', 'a', 'init', 'b']);
	}
});
