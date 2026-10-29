import { test } from '@vigla/harness/helpers';

export default test({
	server_props: { condition: false },
	props: { condition: true },

	snapshot(target) {
		return { element: target.querySelector('div'), sibling: target.querySelector(':scope > p') };
	}
});
