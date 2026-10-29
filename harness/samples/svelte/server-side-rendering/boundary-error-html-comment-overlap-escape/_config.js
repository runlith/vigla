import { test } from '@vigla/harness/helpers';

export default test({
	props: {
		query: '<!--><!--->-->'
	},
	transformError: (error) => ({ message: /** @type {Error} */ (error).message })
});
