import { test } from '@dromon/harness/helpers';

export default test({
	preprocess: [
		{
			script: ({ content }) => ({ code: content.replace(/one/g, 'two') }),
			style: ({ content }) => ({ code: content.replace(/one/g, 'three') })
		}
	]
});
