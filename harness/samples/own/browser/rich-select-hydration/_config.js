import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

let before;

export default test({
	mode: ['client', 'hydrate'],
	before_test() {
		const select = document.querySelector('main select');
		before = select && {
			select,
			button: select.querySelector('button'),
			option: select.querySelector('option'),
			span: select.querySelector('option span'),
			paragraph: document.querySelector('main p')
		};
	},
	test({ assert, target }) {
		const select = target.querySelector('select');
		const button = select.querySelector('button');
		const option = select.querySelector('option');
		const span = option.querySelector('span');
		assert.ok(button);
		assert.ok(span);
		if (before) {
			assert.ok(before.span);
			assert.equal(select, before.select);
			assert.equal(button, before.button);
			assert.equal(option, before.option);
			assert.equal(span, before.span);
			assert.equal(target.querySelector('p'), before.paragraph);
		}
		assert.equal(span.textContent, 'first');
		flushSync(() => target.lastElementChild.click());
		assert.equal(span.textContent, 'second');
		assert.equal(target.querySelector('p').textContent, 'second');
	}
});
