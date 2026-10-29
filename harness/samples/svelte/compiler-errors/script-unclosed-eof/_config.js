import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'unexpected_eof',
		message: 'Unexpected end of input',
		position: [32, 32]
	}
});
