import { flushSync } from 'svelte';
import { ok, test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		dev: true
	},

	test({ assert, target, warnings }) {
		const input = target.querySelector('input');
		ok(input);

		input.checked = true;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		assert.deepEqual(warnings, []);
	},

	warnings: []
});
