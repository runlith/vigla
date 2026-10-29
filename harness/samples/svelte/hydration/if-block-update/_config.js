import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	props: {
		foo: true,
		bar: false
	},
	trim_whitespace: false,

	snapshot(target) {
		const p = target.querySelector('p');

		return {
			p
		};
	},

	test(assert, target, _, component) {
		flushSync(() => {
			component.foo = false;
			component.bar = true;
		});
		assert.htmlEqual(target.innerHTML, '<p>bar!</p>');
	}
});
