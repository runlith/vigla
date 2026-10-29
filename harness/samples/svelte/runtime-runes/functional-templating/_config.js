import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		fragments: 'tree'
	},

	html: `<p>hello</p>`
});
