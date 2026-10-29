import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'rune_invalid_name',
		message: '`$effect.imnotarune` is not a valid rune'
	}
});
