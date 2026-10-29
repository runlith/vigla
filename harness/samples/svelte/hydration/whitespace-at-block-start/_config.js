import { test } from '@vigla/harness/helpers';

export default test({
	errors: [
		'Failed to hydrate: ',
		new DOMException("Node can't be inserted in a #text parent.", 'HierarchyRequestError')
	]
});
