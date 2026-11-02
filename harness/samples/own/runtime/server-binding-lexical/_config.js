import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['server', 'async-server'],
	compileOptions: { dev: true },
	ssrHtml: '<div><p>ok:1</p></div><aside><span>0</span><span>1</span></aside><p>1</p>'
});
