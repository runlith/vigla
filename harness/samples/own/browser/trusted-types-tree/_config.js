import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { fragments: 'tree' },
	before_test() {
		const meta = document.createElement('meta');
		meta.httpEquiv = 'Content-Security-Policy';
		meta.content = "require-trusted-types-for 'script'; trusted-types svelte-trusted-html";
		document.head.append(meta);
	},
	test({ assert, target }) {
		assert.equal(document.documentElement.dataset.trustedTree, 'ran');
		assert.equal(
			document.head.querySelector('script[src]')?.getAttribute('src'),
			'data:text/javascript,void 0'
		);
		assert.equal(target.querySelector('iframe')?.getAttribute('srcdoc'), '<p>framed</p>');
	}
});
