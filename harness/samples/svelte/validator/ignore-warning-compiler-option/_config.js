import { test } from '@vigla/harness/helpers';

export default test({
	compileOptions: {
		warningFilter: (warning) =>
			!['a11y_missing_attribute', 'a11y_misplaced_scope'].includes(warning.code)
	}
});
