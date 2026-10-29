import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'snippet_parameter_assignment',
		message: 'Cannot reassign or bind to snippet parameter'
	}
});
