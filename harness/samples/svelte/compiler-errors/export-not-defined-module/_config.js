import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'export_undefined',
		message: '`blah` is not defined',
		position: [26, 30]
	}
});
