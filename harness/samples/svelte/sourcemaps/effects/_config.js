import { test } from '@dromon/harness/helpers';

export default test({
	client: [
		{ str: '$effect.pre', strGenerated: '$.user_pre_effect' },
		{ str: '$effect', strGenerated: '$.user_effect' }
	],
	server: []
});
