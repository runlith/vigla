import { test } from '@dromon/harness/helpers';

export default test({
	props: {
		query: '--><img src=x onerror=alert(1)><!--'
	},
	transformError: (error) => ({ message: /** @type {Error} */ (error).message })
});
