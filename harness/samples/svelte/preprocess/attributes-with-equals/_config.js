import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: {
		style: ({ attributes }) => {
			if (typeof attributes.foo === 'string' && attributes.foo.includes('=')) {
				return { code: '' };
			}
		}
	}
});
