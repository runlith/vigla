import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	test({ assert, target }) {
		const button = target.querySelector('button');

		assert.throws(() => {
			button?.click();
			flushSync();
		}, /state_unsafe_mutation/);
	}
});
