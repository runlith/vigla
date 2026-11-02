import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server'],
	html: '<p>parent</p><p>child</p>'
});
