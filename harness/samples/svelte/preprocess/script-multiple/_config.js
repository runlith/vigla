import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		script: ({ content }) => {
			return {
				code: content.toLowerCase()
			};
		}
	}
});
