import { test } from '@dromon/harness/helpers';

export default test({
	props: {
		query: '<!--><!--->-->'
	},
	transformError: (error) => ({ message: /** @type {Error} */ (error).message })
});
