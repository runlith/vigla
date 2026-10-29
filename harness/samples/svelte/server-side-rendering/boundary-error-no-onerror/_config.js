import { test } from '@dromon/harness/helpers';

export default test({
	// No transformError - by default the server throws, so the error should propagate.
	error: 'component error'
});
