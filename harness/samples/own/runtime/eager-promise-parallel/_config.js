import { settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: true },
	async test({ assert, target, warnings }) {
		await new Promise(resolve => setTimeout(resolve, 0));
		await new Promise(resolve => setTimeout(resolve, 200));
		await settled();
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.deepEqual([...target.querySelectorAll('pre')].map(node => node.textContent), ['{"a":1}', '{"a":1}']);
		assert.deepEqual(warnings, []);
	}
});
