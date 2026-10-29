import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'rune_renamed',
		message: '`$effect.active` is now `$effect.tracking`'
	}
});
