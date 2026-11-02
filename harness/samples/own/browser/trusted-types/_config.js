import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	props: { shown: false, markup: '' },
	before_test() {
		const meta = document.createElement('meta');
		meta.httpEquiv = 'Content-Security-Policy';
		meta.content =
			"require-trusted-types-for 'script'; trusted-types svelte-trusted-html trusted-types-sample 'allow-duplicates'";
		document.head.append(meta);
	},
	test({ assert, component, target }) {
		let refused = false;
		try {
			document.createElement('div').innerHTML = '<b></b>';
		} catch {
			refused = true;
		}
		assert.ok(refused);
		assert.equal(target.querySelector('b')?.textContent, 'raw');
		assert.equal(target.querySelector('span')?.textContent, 'rich');
		const policy = window.trustedTypes.createPolicy('trusted-types-sample', {
			createHTML: (html) => html
		});
		flushSync(() => {
			component.shown = true;
			component.markup = policy.createHTML('<u>trusted</u>');
		});
		assert.equal(target.querySelector('em')?.textContent, 'later');
		assert.equal(target.querySelector('div')?.innerHTML, '<u>trusted</u>');
	}
});
