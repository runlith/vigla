import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		style: ({ content }) => {
			return { code: content, map: { mappings: '' } };
		}
	}
});
