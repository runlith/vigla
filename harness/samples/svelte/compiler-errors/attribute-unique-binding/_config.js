import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'attribute_duplicate',
		message: 'Attributes need to be unique',
		position: [17, 25]
	}
});
