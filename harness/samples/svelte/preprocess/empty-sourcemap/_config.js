import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		style: ({ content }) => {
			return { code: content, map: { mappings: '' } };
		}
	}
});
