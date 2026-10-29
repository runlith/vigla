import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: {
		script: ({ attributes }) =>
			typeof attributes.generics === 'string' && attributes.generics.includes('>')
				? { code: '' }
				: undefined
	}
});
