import { test } from '@vigla/harness/helpers';

export default test({
	props: {
		query: '<!--<script>alert(1)</script>'
	},
	transformError: (error) => ({ message: /** @type {Error} */ (error).message })
});
