import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		style: ({ content }) => {
			return Promise.resolve({
				code: content.replace('$brand', 'purple')
			});
		}
	}
});
