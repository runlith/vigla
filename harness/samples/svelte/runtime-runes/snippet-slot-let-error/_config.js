import { test } from '@dromon/harness/helpers';

export default test({
	skip_mode: ['hydrate', 'server'],
	compileOptions: {
		dev: true
	},
	runtime_error: 'invalid_default_snippet'
});
