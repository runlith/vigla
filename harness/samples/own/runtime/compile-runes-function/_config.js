import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	html: '<p>1</p>'
});
