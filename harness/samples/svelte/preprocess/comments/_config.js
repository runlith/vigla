import { test } from '@vigla/harness/helpers';

export default test({
	preprocess: [
		{
			script: ({ content }) => ({ code: content.replace(/one/g, 'two') }),
			style: ({ content }) => ({ code: content.replace(/one/g, 'three') })
		}
	]
});
