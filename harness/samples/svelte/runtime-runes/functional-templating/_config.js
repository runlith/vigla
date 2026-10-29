import { test } from '@dromon/harness/helpers';

export default test({
	compileOptions: {
		fragments: 'tree'
	},

	html: `<p>hello</p>`
});
