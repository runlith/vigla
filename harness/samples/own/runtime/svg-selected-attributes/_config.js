import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'hydrate'],
	test({ assert, target }) {
		const options = [...target.querySelectorAll('svg option')];
		const html = target.querySelector('select option');
		assert.deepEqual(options.map((option) => option.getAttribute('selected')), ['true', 'true']);
		assert.equal(html.getAttribute('selected'), '');
		flushSync(() => target.querySelector('button').click());
		assert.deepEqual(options.map((option) => option.getAttribute('selected')), ['false', 'false']);
		assert.equal(html.getAttribute('selected'), null);
	}
});
