import { test } from '@vigla/harness/helpers';

export default test({
	props: {
		foo: "<p>this should be <em>escaped</em> & so should 'this'</p>"
	}
});
