import { flushSync } from 'svelte';
import { test, ok } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],
	test({ assert, target }) {
		const svg = target.querySelector('svg');
		const button = target.querySelector('button');
		ok(svg);
		ok(button);

		assert.equal(svg.getAttribute('class'), '0');
		flushSync(() => {
			button.click();
		});
		assert.equal(svg.getAttribute('class'), '1');
	}
});
