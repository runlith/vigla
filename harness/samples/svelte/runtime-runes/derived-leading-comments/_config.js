import { test } from '@vigla/harness/helpers';

export default test({
	ssrHtml: '<p>y:y</p> <p>LATER</p> <input value="LATER">',
	html: '<p>y:y</p> <p>LATER</p> <input>'
});
