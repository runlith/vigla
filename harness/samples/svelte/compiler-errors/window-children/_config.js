import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'svelte_meta_invalid_content',
		message: '<svelte:window> cannot have children',
		position: [15, 23]
	}
});
