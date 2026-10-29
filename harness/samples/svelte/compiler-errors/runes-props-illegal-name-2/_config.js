import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'props_illegal_name',
		message:
			'Declaring or accessing a prop starting with `$$` is illegal (they are reserved for Svelte internals)'
	}
});
