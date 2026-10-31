import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server'],
	transformError: (error) => error,
	ssrHtml: '<p>failed</p>'
});
