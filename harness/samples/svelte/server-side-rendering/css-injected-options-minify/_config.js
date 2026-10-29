import { test } from '@vigla/harness/helpers';

export default test({
	// test checks that minification works correctly
	compileOptions: {
		css: 'external'
	}
});
