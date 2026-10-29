import { test } from '@vigla/harness/helpers';

export default test({
	ssrHtml: `<div></div>`,
	html: `<div><h1>hello</h1><h2>it's me</h2><h2>or not</h2></div>`,

	test() {}
});
