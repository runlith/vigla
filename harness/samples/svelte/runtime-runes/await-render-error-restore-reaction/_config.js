import { ok, test } from '@vigla/harness/helpers';
import { flushSync } from 'svelte';

export default test({
	compileOptions: {
		dev: true
	},
	async test({ target, errors, assert, window }) {
		const btn = target.querySelector('button');
		ok(btn);
		flushSync(() => {
			btn.click();
		});
		assert.deepEqual(errors, []);
	}
});
