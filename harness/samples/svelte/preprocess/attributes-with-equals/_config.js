import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		style: ({ attributes }) => {
			if (typeof attributes.foo === 'string' && attributes.foo.includes('=')) {
				return { code: '' };
			}
		}
	}
});
