import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	test({ assert, target, warnings }) {
		const btn = target.querySelector('button');
		btn?.click();
		flushSync();

		assert.deepEqual(warnings, []);
	},

	warnings: []
});
