import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	html: '<button></button><div>0</div>',
	mode: ['client'],
	test({ assert, target }) {
		let btn = target.querySelector('button');
		let div = target.querySelector('div');

		flushSync(() => {
			btn?.click();
		});

		assert.equal(div?.innerHTML, `1`);
	}
});
