import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	before_test() {
		const meta = document.createElement('meta');
		meta.httpEquiv = 'Content-Security-Policy';
		meta.content =
			"require-trusted-types-for 'script'; trusted-types svelte-trusted-html trusted-types-sinks 'allow-duplicates'";
		document.head.append(meta);
	},
	test({ assert, component, target }) {
		assert.equal(document.documentElement.dataset.trustedText, 'ran');
		assert.equal(
			document.head.querySelector('script[src]')?.getAttribute('src'),
			'data:text/javascript,void 0'
		);
		const policy = window.trustedTypes.createPolicy('trusted-types-sinks', {
			createHTML: (html) => html
		});
		flushSync(() => {
			component.markup = policy.createHTML('<u>bound</u>');
		});
		assert.equal(target.querySelector('div')?.innerHTML, '<u>bound</u>');
	}
});
