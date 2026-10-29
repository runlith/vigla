import { test } from '@vigla/harness/helpers';

export default test({
	error: {
		code: 'runes_mode_invalid_import',
		message: 'beforeUpdate cannot be used in runes mode'
	}
});
