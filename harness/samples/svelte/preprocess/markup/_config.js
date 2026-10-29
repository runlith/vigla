import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		markup: ({ content }) => {
			return {
				code: content.replace('__NAME__', 'world')
			};
		}
	}
});
