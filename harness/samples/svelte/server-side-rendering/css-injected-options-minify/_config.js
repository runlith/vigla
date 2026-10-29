import { test } from '@dromon/harness/helpers';

export default test({
	// test checks that minification works correctly
	compileOptions: {
		css: 'external'
	}
});
