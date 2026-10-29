import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'global_reference_invalid',
		message:
			'`$foo` is an illegal variable name. To reference a global variable called `$foo`, use `globalThis.$foo`'
	}
});
