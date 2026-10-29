import { test } from '@dromon/harness/helpers';

export default test({
	error: {
		code: 'host_invalid_placement',
		message: '`$host()` can only be used inside custom element component instances'
	}
});
