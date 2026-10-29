import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'runes_mode_invalid_import',
		message: 'beforeUpdate cannot be used in runes mode'
	}
});
