import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		script: ({ content }) => {
			return {
				code: content.toLowerCase()
			};
		}
	}
});
