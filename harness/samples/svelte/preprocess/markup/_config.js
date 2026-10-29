import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		markup: ({ content }) => {
			return {
				code: content.replace('__NAME__', 'world')
			};
		}
	}
});
