import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		style: ({ content }) => {
			return Promise.resolve({
				code: content.replace('$brand', 'purple')
			});
		}
	}
});
