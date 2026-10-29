import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'global_reference_invalid',
		message:
			'`$` is an illegal variable name. To reference a global variable called `$`, use `globalThis.$`'
	}
});
