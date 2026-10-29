import { test } from '@vigla/harness/helpers';

export default test({
	transformError: (error) => {
		if (/** @type {Error} */ (error).message !== 'you are not supposed to see this message') {
			return 'wrong object passed to transformError';
		}
		return 'component error';
	}
});
