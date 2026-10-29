import { test } from '@dromon/harness/helpers';

export default test({
	html: `<button>clicks: 0</button>`,

	compileOptions: {
		dev: true
	},

	warnings: []
});
